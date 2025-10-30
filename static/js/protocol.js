/**
 * True P2P Protocol Implementation (WebRTC DataChannels)
 * 
 * This module implements a true peer-to-peer file sharing protocol using WebRTC
 * DataChannels for direct communication between browsers. The server only acts
 * as a signaling server to facilitate WebRTC connection establishment.
 * 
 * Features:
 * - Direct peer-to-peer communication
 * - WebRTC DataChannels for file transfer
 * - NAT traversal with STUN servers
 * - Real-time progress tracking
 * - File chunking and reconstruction
 * - Error handling and recovery
 */

class TrueP2PProtocol {
    /**
     * Initialize the True P2P Protocol
     * @param {string} transferId - Unique transfer identifier
     * @param {boolean} isSender - Whether this instance is the sender
     */
    constructor(transferId, isSender = false) {
        this.transferId = transferId;
        this.isSender = isSender;
        this.file = null;
        this.chunks = [];
        this.chunkSize = 64 * 1024; // 64 KB chunks
        this.peers = new Map();
        this.receivedChunks = new Map();
        this.totalChunks = 0;
        this.downloadedChunks = 0;
        this.status = 'initializing';
        this.offerCreated = false;
        this.offerReceived = false;
        this.pendingChunk = null; // To store chunk metadata while waiting for binary data
        this.pendingIceCandidates = []; // Queue ICE candidates until remoteDescription is set

        // WebRTC components
        this.pc = null;
        this.dataChannel = null;
        this.iceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ];

        console.log(`True P2P: Protocol initialized for transfer ${transferId}, sender: ${isSender}`);
        this.init();
    }

    /**
     * Initialize the protocol
     * Sets up WebRTC components and event handlers
     */
    init() {
        console.log('True P2P: Initializing WebRTC components');
        this.setupWebRTC();
        this.status = 'ready';
        console.log('True P2P: Protocol ready for P2P operations');
    }

    /**
     * Set up WebRTC peer connection
     * Configures RTCPeerConnection with STUN servers
     */
    setupWebRTC() {
        try {
            console.log('True P2P: Setting up WebRTC peer connection');

            // Create RTCPeerConnection
            this.pc = new RTCPeerConnection({
                iceServers: this.iceServers
            });

            // Handle ICE candidates
            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('True P2P: ICE candidate generated');
                    this.sendToSignalingServer('webrtc_ice_candidate', {
                        transferId: this.transferId,
                        candidate: event.candidate
                    });
                }
            };

            // Handle connection state changes
            this.pc.onconnectionstatechange = () => {
                console.log('True P2P: Connection state changed:', this.pc.connectionState);
                if (this.pc.connectionState === 'connected') {
                    this.status = 'connected';
                    console.log('True P2P: Peer connection established');
                } else if (this.pc.connectionState === 'failed') {
                    this.status = 'failed';
                    console.error('True P2P: Peer connection failed');
                }
            };

            // Handle ICE connection state changes
            this.pc.oniceconnectionstatechange = () => {
                console.log('True P2P: ICE connection state:', this.pc.iceConnectionState);
            };

            // Set up data channel
            this.setupDataChannel();

        } catch (error) {
            console.error('True P2P: Error setting up WebRTC:', error);
            this.status = 'failed';
        }
    }

    /**
     * Set up WebRTC data channel
     * Configures data channel for file transfer
     */
    setupDataChannel() {
        try {
            console.log('True P2P: Setting up data channel');

            if (this.isSender) {
                // Create data channel as sender
                this.dataChannel = this.pc.createDataChannel('fileTransfer', {
                    ordered: true,
                    maxRetransmits: 3
                });
                this.setupDataChannelEvents();
            } else {
                // Set up data channel event handler for receiver
                this.pc.ondatachannel = (event) => {
                    console.log('True P2P: Data channel received');
                    this.dataChannel = event.channel;
                    this.setupDataChannelEvents();
                };
            }

        } catch (error) {
            console.error('True P2P: Error setting up data channel:', error);
        }
    }

    /**
     * Set up data channel event handlers
     * Handles data channel events for file transfer
     */
    setupDataChannelEvents() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log('True P2P: Data channel opened');
            this.status = 'connected';
            if (this.isSender) {
                // Start sending immediately once channel is open
                this.startDirectTransfer();
            }
        };

        this.dataChannel.onclose = () => {
            console.log('True P2P: Data channel closed');
            this.status = 'disconnected';
        };

        this.dataChannel.onerror = (error) => {
            console.error('True P2P: Data channel error:', error);
            this.status = 'failed';
        };

        this.dataChannel.onmessage = (event) => {
            console.log('True P2P: Data channel message received');

            // Handle different message types
            if (event.data instanceof ArrayBuffer) {
                this.handleBinaryMessage(event.data);
            } else {
                this.handleDirectMessage(event.data);
            }
        };
    }

    /**
     * Convert Blob to ArrayBuffer (helper)
     * @param {Blob} blob
     * @returns {Promise<ArrayBuffer>}
     */
    async blobToArrayBuffer(blob) {
        if (blob.arrayBuffer) {
            return await blob.arrayBuffer();
        }
        return await new Response(blob).arrayBuffer();
    }

    /**
     * Set the file for processing
     * @param {File} file - The file to process
     */
    setFile(file) {
        this.file = file;
        console.log(`True P2P: File set for processing: ${file.name} (${file.size} bytes)`);
        this.chunkFile();
    }

    /**
     * Chunk file for P2P transfer
     * Splits file into chunks for efficient transfer
     */
    chunkFile() {
        if (!this.file) {
            console.error('True P2P: No file set for chunking');
            return;
        }

        console.log('True P2P: Chunking file for P2P transfer');
        console.log(`True P2P: File size: ${this.file.size} bytes, chunk size: ${this.chunkSize} bytes`);

        this.chunks = [];
        const fileSize = this.file.size;
        this.totalChunks = Math.ceil(fileSize / this.chunkSize);

        console.log(`True P2P: File will be split into ${this.totalChunks} chunks`);

        // Create chunks
        for (let i = 0; i < this.totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, fileSize);
            const chunkData = this.file.slice(start, end);

            const chunk = {
                index: i,
                data: chunkData,
                size: chunkData.size,
                checksum: this.calculateChecksum(chunkData),
                totalChunks: this.totalChunks
            };

            this.chunks.push(chunk);
            console.log(`True P2P: Created chunk ${i + 1}/${this.totalChunks} (${chunk.size} bytes)`);
        }

        console.log(`True P2P: File split into ${this.chunks.length} chunks successfully`);
    }

    /**
     * Calculate checksum for chunk validation
     * @param {Blob} data - Chunk data
     * @returns {string} Checksum string
     */
    calculateChecksum(data) {
        // Simple checksum implementation for demonstration
        // In production, use a proper hash function like SHA-256
        let checksum = 0;
        const reader = new FileReader();

        return new Promise((resolve) => {
            reader.onload = function (e) {
                const arrayBuffer = e.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);

                for (let i = 0; i < uint8Array.length; i++) {
                    checksum = ((checksum << 5) - checksum + uint8Array[i]) & 0xffffffff;
                }

                resolve(checksum.toString(16));
            };
            reader.readAsArrayBuffer(data);
        });
    }

    /**
     * Start direct file transfer
     * Sends file metadata and chunks directly to peer
     */
    async startDirectTransfer() {
        if (!this.isSender || !this.file) {
            console.log('True P2P: Not a sender or no file set');
            return;
        }

        try {
            console.log('True P2P: Starting direct file transfer');

            // Send file metadata
            const metadata = {
                name: this.file.name,
                size: this.file.size,
                type: this.file.type,
                totalChunks: this.totalChunks,
                chunkSize: this.chunkSize,
                lastModified: this.file.lastModified
            };

            this.sendDirectMessage({
                type: 'metadata',
                data: metadata
            });

            console.log('True P2P: File metadata sent to peer');

            // Send file chunks
            for (let i = 0; i < this.chunks.length; i++) {
                const chunk = this.chunks[i];
                console.log(`True P2P: Sending chunk ${i + 1}/${this.chunks.length}`);

                // Convert chunk to ArrayBuffer
                const arrayBuffer = await this.blobToArrayBuffer(chunk.data);

                this.sendDirectMessage({
                    type: 'chunk',
                    data: {
                        index: chunk.index,
                        data: arrayBuffer,
                        checksum: chunk.checksum,
                        totalChunks: chunk.totalChunks
                    }
                });

                // Update progress
                const progress = ((i + 1) / this.chunks.length) * 100;
                this.updateProgress(progress);
            }

            console.log('True P2P: Direct file transfer completed');

        } catch (error) {
            console.error('True P2P: Error during direct transfer:', error);
            throw error;
        }
    }

    /**
     * Send message directly to peer (no server)
     * @param {Object} message - Message to send
     */
    sendDirectMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            // For chunk data, send ArrayBuffer directly, for other messages use JSON
            if (message.type === 'chunk' && message.data.data instanceof ArrayBuffer) {
                // Send metadata first
                const metadata = {
                    type: message.type,
                    data: {
                        index: message.data.index,
                        checksum: message.data.checksum,
                        totalChunks: message.data.totalChunks,
                        dataLength: message.data.data.byteLength
                    }
                };
                this.dataChannel.send(JSON.stringify(metadata));

                // Then send the ArrayBuffer
                this.dataChannel.send(message.data.data);
            } else {
                this.dataChannel.send(JSON.stringify(message));
            }
        } else {
            console.error('True P2P: Data channel not ready for direct communication');
        }
    }

    /**
     * Handle binary messages (ArrayBuffer data)
     * @param {ArrayBuffer} arrayBuffer - Binary data received
     */
    handleBinaryMessage(arrayBuffer) {
        console.log('True P2P: Received binary data, length:', arrayBuffer.byteLength);

        // Store the binary data for the pending chunk
        if (this.pendingChunk) {
            this.pendingChunk.data = arrayBuffer;
            this.receivedChunks.set(this.pendingChunk.index, this.pendingChunk);

            console.log(`True P2P: Stored chunk ${this.pendingChunk.index + 1}/${this.pendingChunk.totalChunks} with ${arrayBuffer.byteLength} bytes`);

            this.downloadedChunks++;
            const progress = (this.downloadedChunks / this.totalChunks) * 100;
            this.updateProgress(progress);

            console.log(`True P2P: Downloaded ${this.downloadedChunks}/${this.totalChunks} chunks`);

            if (this.downloadedChunks === this.totalChunks) {
                console.log('True P2P: All chunks received directly from peer - reconstructing file');
                this.reconstructFile();
            }

            this.pendingChunk = null;
        }
    }

    /**
     * Handle messages received directly from peer
     * @param {string} data - JSON message data
     */
    handleDirectMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'metadata':
                    console.log('True P2P: Received metadata directly from peer:', message.data);
                    this.metadata = message.data;
                    this.totalChunks = message.data.totalChunks;
                    break;

                case 'chunk':
                    console.log(`True P2P: Received chunk metadata ${message.data.index + 1}/${message.data.totalChunks} directly from peer`);
                    console.log('True P2P: Expected chunk data length:', message.data.dataLength);

                    // Store chunk metadata and wait for binary data
                    this.pendingChunk = {
                        index: message.data.index,
                        checksum: message.data.checksum,
                        totalChunks: message.data.totalChunks,
                        data: null // Will be filled by handleBinaryMessage
                    };
                    break;
            }
        } catch (error) {
            console.error('True P2P: Error handling direct message:', error);
        }
    }

    /**
     * Reconstruct file from received chunks
     * Assembles downloaded chunks into the original file
     */
    reconstructFile() {
        console.log('True P2P: Reconstructing file from', this.receivedChunks.size, 'chunks');

        // Sort chunks by index
        const sortedChunks = Array.from(this.receivedChunks.entries())
            .sort((a, b) => a[0] - b[0]);

        console.log('True P2P: Sorted chunks:', sortedChunks.map(([index, chunk]) => ({ index, size: chunk.data.size })));

        // Extract chunk data
        const chunkData = sortedChunks.map(entry => entry[1].data);

        console.log('True P2P: Chunk data lengths:', chunkData.map(chunk => chunk.byteLength || chunk.length));

        const blob = new Blob(chunkData, {
            type: this.metadata.type || 'application/octet-stream'
        });

        console.log('True P2P: File reconstructed from direct peer transfer, size:', blob.size);
        console.log('True P2P: Expected size:', this.metadata.size);

        this.downloadFile(blob, this.metadata.name);
    }

    /**
     * Download reconstructed file
     * @param {Blob} blob - Reconstructed file blob
     * @param {string} filename - Original filename
     */
    downloadFile(blob, filename) {
        console.log('True P2P: Downloading reconstructed file');

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('True P2P: File download completed');
    }

    /**
     * Send message to signaling server
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    sendToSignalingServer(event, data) {
        if (window.socket) {
            window.socket.emit(event, data);
        } else {
            console.error('True P2P: Socket not available for signaling');
        }
    }

    /**
     * Handle WebRTC offer
     * @param {RTCSessionDescriptionInit} offer - WebRTC offer
     * @param {string} senderSid - Socket ID of the original offer sender
     */
    async handleWebRTCOffer(offer, senderSid) {
        try {
            console.log('True P2P: Handling WebRTC offer');
            this.offerReceived = true;

            await this.pc.setRemoteDescription(offer);
            // Flush any queued ICE candidates now that remote description is set
            if (this.pendingIceCandidates.length) {
                console.log(`True P2P: Flushing ${this.pendingIceCandidates.length} queued ICE candidates (receiver)`);
                for (const cand of this.pendingIceCandidates) {
                    try { await this.pc.addIceCandidate(cand); } catch (e) { console.error('True P2P: Failed queued ICE (receiver):', e); }
                }
                this.pendingIceCandidates = [];
            }
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);

            this.sendToSignalingServer('webrtc_answer', {
                transferId: this.transferId,
                answer: answer,
                senderSid: senderSid
            });

            console.log('True P2P: WebRTC answer sent back to offer sender');
        } catch (error) {
            console.error('True P2P: Error handling WebRTC offer:', error);
        }
    }

    /**
     * Handle WebRTC answer
     * @param {RTCSessionDescriptionInit} answer - WebRTC answer
     */
    async handleWebRTCAnswer(answer) {
        try {
            console.log('True P2P: Handling WebRTC answer');
            await this.pc.setRemoteDescription(answer);
            // Flush queued ICE candidates now that remote description is set
            if (this.pendingIceCandidates.length) {
                console.log(`True P2P: Flushing ${this.pendingIceCandidates.length} queued ICE candidates (sender)`);
                for (const cand of this.pendingIceCandidates) {
                    try { await this.pc.addIceCandidate(cand); } catch (e) { console.error('True P2P: Failed queued ICE (sender):', e); }
                }
                this.pendingIceCandidates = [];
            }
            console.log('True P2P: WebRTC answer processed');
        } catch (error) {
            console.error('True P2P: Error handling WebRTC answer:', error);
        }
    }

    /**
     * Handle ICE candidate
     * @param {RTCIceCandidateInit} candidate - ICE candidate
     */
    async handleICECandidate(candidate) {
        try {
            console.log('True P2P: Handling ICE candidate');
            if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
                // Remote description not set yet; queue candidate
                this.pendingIceCandidates.push(candidate);
                console.log('True P2P: Queued ICE candidate (remoteDescription not set yet)');
                return;
            }
            await this.pc.addIceCandidate(candidate);
            console.log('True P2P: ICE candidate added');
        } catch (error) {
            console.error('True P2P: Error handling ICE candidate:', error);
        }
    }

    /**
     * Create WebRTC offer
     * Initiates peer connection as sender
     */
    async createOffer() {
        try {
            console.log('True P2P: Creating WebRTC offer');
            this.offerCreated = true;

            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            this.sendToSignalingServer('webrtc_offer', {
                transferId: this.transferId,
                offer: offer
            });

            console.log('True P2P: WebRTC offer sent');
        } catch (error) {
            console.error('True P2P: Error creating WebRTC offer:', error);
        }
    }

    /**
     * Handle receiver joined event
     * Called when a receiver joins the transfer room
     */
    onReceiverJoined() {
        console.log('True P2P: Receiver joined, creating offer');
        if (this.isSender && !this.offerCreated) {
            // Small delay to ensure receiver is ready
            setTimeout(() => {
                this.createOffer();
            }, 1000);
        }
    }

    /**
     * Check connection status
     * @returns {string} Current connection status
     */
    checkConnection() {
        if (this.pc) {
            console.log('True P2P: Connection state:', this.pc.connectionState);
            console.log('True P2P: ICE connection state:', this.pc.iceConnectionState);
            console.log('True P2P: Data channel state:', this.dataChannel ? this.dataChannel.readyState : 'Not available');
        }
        return this.status;
    }

    /**
     * Reconnect to peer
     * Attempts to re-establish connection
     */
    reconnect() {
        console.log('True P2P: Attempting to reconnect');
        this.setupWebRTC();
        if (this.isSender) {
            this.createOffer();
        }
    }

    /**
     * Update progress
     * @param {number} percentage - Progress percentage
     */
    updateProgress(percentage) {
        console.log(`True P2P: Progress: ${Math.round(percentage)}%`);
        // This will be overridden by the UI components
    }

    /**
     * Clean up protocol resources
     */
    cleanup() {
        console.log('True P2P: Cleaning up protocol resources');

        if (this.dataChannel) {
            this.dataChannel.close();
        }

        if (this.pc) {
            this.pc.close();
        }

        this.chunks = [];
        this.receivedChunks.clear();
        this.status = 'cleaned';
        console.log('True P2P: Protocol cleanup completed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrueP2PProtocol;
}
