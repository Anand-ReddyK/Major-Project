/**
 * True P2P Upload Page JavaScript
 * 
 * This module handles the file upload process using the True P2P Protocol.
 * It provides functionality for:
 * - File selection and validation
 * - WebRTC connection establishment
 * - Direct peer-to-peer file transfer
 * - Progress tracking and status updates
 * - Shareable URL generation
 * 
 * The implementation uses WebRTC DataChannels for direct communication
 * between browsers without server storage of file data.
 */

// Global variables for True P2P functionality
let trueP2P = null;
let selectedFiles = [];
let transferId = null;
let socket = null;

// DOM elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const resetBtn = document.getElementById('resetBtn');
const webrtcStatus = document.getElementById('webrtcStatus');
const connectionStatus = document.getElementById('connectionStatus');
const dataChannelStatus = document.getElementById('dataChannelStatus');
const progressSection = document.getElementById('progressSection');
const progressBar = document.querySelector('.progress-bar');
const progressText = document.getElementById('progressText');
const peerStatus = document.getElementById('peerStatus');
const peerConnection = document.getElementById('peerConnection');
const transferStatus = document.getElementById('transferStatus');
const shareResult = document.getElementById('shareResult');
const shareUrl = document.getElementById('shareUrl');

/**
 * Initialize the True P2P upload page
 * Sets up event listeners and initializes WebSocket connection
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('True P2P Upload: Page initialized');

    // Initialize WebSocket connection for signaling
    initializeWebSocket();

    // Set up event listeners
    fileInput.addEventListener('change', handleFileSelection);
    uploadBtn.addEventListener('click', startTrueP2PUpload);
});

/**
 * Initialize WebSocket connection for signaling
 * Sets up Socket.IO connection for WebRTC signaling
 */
function initializeWebSocket() {
    try {
        console.log('True P2P Upload: Initializing WebSocket connection');
        socket = io();

        socket.on('connect', () => {
            console.log('True P2P Upload: WebSocket connected');
        });

        socket.on('disconnect', () => {
            console.log('True P2P Upload: WebSocket disconnected');
        });

        socket.on('joined_room', (data) => {
            console.log('True P2P Upload: Joined room:', data.transferId);
        });

        socket.on('peer_joined', (data) => {
            console.log('True P2P Upload: Peer joined room:', data.transferId);
            if (trueP2P) {
                trueP2P.onReceiverJoined();
            }
        });

        socket.on('offer_requested', (data) => {
            console.log('True P2P Upload: Offer requested for transfer:', data.transferId);
            if (trueP2P) {
                trueP2P.onReceiverJoined(); // Re-create offer if requested
            }
        });

        socket.on('webrtc_answer', (data) => {
            console.log('True P2P Upload: Received WebRTC answer');
            if (trueP2P) {
                trueP2P.handleWebRTCAnswer(data.answer);
            }
        });

        socket.on('webrtc_ice_candidate', (data) => {
            console.log('True P2P Upload: Received ICE candidate');
            if (trueP2P) {
                trueP2P.handleICECandidate(data.candidate);
            }
        });

        // Store socket globally for protocol use
        window.socket = socket;

    } catch (error) {
        console.error('True P2P Upload: Error initializing WebSocket:', error);
    }
}

/**
 * Handle file selection from input
 * Validates files and updates UI accordingly
 */
function handleFileSelection(event) {
    selectedFiles = Array.from(event.target.files);
    console.log('True P2P Upload: Files selected:', selectedFiles.length);

    if (selectedFiles.length > 0) {
        // Validate file sizes (optional limit)
        const maxSize = 100 * 1024 * 1024; // 100MB limit
        const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);

        if (oversizedFiles.length > 0) {
            alert(`Some files exceed 100MB limit. Please select smaller files.`);
            return;
        }

        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-rocket me-2"></i>Start Direct P2P Sharing';
        console.log('True P2P Upload: Files validated successfully');
    } else {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-file-upload me-2"></i>Select Files First';
    }
}

/**
 * Start the True P2P upload process
 * Initializes protocol and begins file processing
 */
async function startTrueP2PUpload() {
    if (selectedFiles.length === 0) {
        alert('Please select files first');
        return;
    }

    try {
        console.log('True P2P Upload: Starting upload process');

        // Generate unique transfer ID
        transferId = generateTransferId();
        console.log('True P2P Upload: Generated transfer ID:', transferId);

        // Show status sections
        webrtcStatus.style.display = 'block';
        progressSection.style.display = 'block';
        peerStatus.style.display = 'block';

        // Disable upload button
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';

        // Update status
        updateConnectionStatus('Initializing WebRTC connection...', 'warning');
        updateDataChannelStatus('Setting up data channel...', 'warning');
        updatePeerConnection('Preparing for peer connection...', 'warning');
        updateTransferStatus('Ready for direct P2P transfer...', 'info');

        // Initialize True P2P protocol
        trueP2P = new TrueP2PProtocol(transferId, true);
        console.log('True P2P Upload: Protocol initialized');

        // Set file for processing
        trueP2P.setFile(selectedFiles[0]); // For simplicity, use first file
        console.log('True P2P Upload: File set for processing');

        // Join transfer room for signaling
        socket.emit('join_transfer_room', { transferId: transferId });
        console.log('True P2P Upload: Joined transfer room for signaling');

        // Create transfer on server
        await createTransferOnServer();

        // Start connection monitoring
        startConnectionMonitoring();

        // Generate shareable URL
        generateShareableUrl();

        // Update UI
        uploadBtn.innerHTML = '<i class="fas fa-share-alt me-2"></i>Sharing via Direct P2P...';
        uploadBtn.classList.remove('btn-success');
        uploadBtn.classList.add('btn-info');
        resetBtn.style.display = 'inline-block';

        console.log('True P2P Upload: Upload process completed successfully');

    } catch (error) {
        console.error('True P2P Upload: Upload failed:', error);
        showError('Upload failed: ' + error.message);
        resetForm();
    }
}

/**
 * Create transfer record on server
 * Sends transfer metadata to server for tracking
 */
async function createTransferOnServer() {
    try {
        console.log('True P2P Upload: Creating transfer on server');

        const metadata = {
            name: selectedFiles[0].name,
            size: selectedFiles[0].size,
            type: selectedFiles[0].type,
            totalChunks: trueP2P.totalChunks,
            chunkSize: trueP2P.chunkSize,
            lastModified: selectedFiles[0].lastModified
        };

        const response = await fetch('/api/create-transfer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transferId: transferId,
                metadata: metadata
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('True P2P Upload: Transfer created on server');
        } else {
            throw new Error(data.error || 'Failed to create transfer');
        }

    } catch (error) {
        console.error('True P2P Upload: Error creating transfer on server:', error);
        throw error;
    }
}

/**
 * Generate shareable URL for the transfer
 * Creates a URL that can be shared with other users
 */
function generateShareableUrl() {
    const shareableUrl = `${window.location.origin}/share/${transferId}`;
    shareUrl.value = shareableUrl;
    shareResult.style.display = 'block';

    console.log('True P2P Upload: Shareable URL generated:', shareableUrl);
    updateConnectionStatus('WebRTC connection ready', 'success');
    updateDataChannelStatus('Data channel ready for P2P transfer', 'success');
}

/**
 * Start connection monitoring
 * Monitors WebRTC connection status and updates UI
 */
function startConnectionMonitoring() {
    const monitorInterval = setInterval(() => {
        if (trueP2P) {
            trueP2P.checkConnection();

            // Update UI based on connection status
            if (trueP2P.status === 'connected') {
                updateConnectionStatus('Connected to peer', 'success');
                updateDataChannelStatus('Data channel active', 'success');
                updatePeerConnection('Peer connection established', 'success');
                updateTransferStatus('Ready for direct file transfer', 'success');
                clearInterval(monitorInterval);
            } else if (trueP2P.status === 'failed') {
                updateConnectionStatus('Connection failed', 'danger');
                updateDataChannelStatus('Data channel failed', 'danger');
                updatePeerConnection('Peer connection failed', 'danger');
                updateTransferStatus('Transfer failed', 'danger');
            }
        }
    }, 2000);
}

/**
 * Generate unique transfer ID
 * Creates a unique identifier for the transfer
 */
function generateTransferId() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    return `true-p2p-${timestamp}-${randomId}`;
}

/**
 * Update connection status display
 */
function updateConnectionStatus(message, type = 'info') {
    if (connectionStatus) {
        const iconClass = type === 'success' ? 'fa-check-circle text-success' :
            type === 'warning' ? 'fa-exclamation-triangle text-warning' :
                type === 'danger' ? 'fa-times text-danger' :
                    'fa-info-circle text-info';

        connectionStatus.innerHTML = `<i class="fas ${iconClass} me-2"></i>${message}`;
    }
}

/**
 * Update data channel status display
 */
function updateDataChannelStatus(message, type = 'info') {
    if (dataChannelStatus) {
        const iconClass = type === 'success' ? 'fa-check-circle text-success' :
            type === 'warning' ? 'fa-exclamation-triangle text-warning' :
                type === 'danger' ? 'fa-times text-danger' :
                    'fa-info-circle text-info';

        dataChannelStatus.innerHTML = `<i class="fas ${iconClass} me-2"></i>${message}`;
    }
}

/**
 * Update peer connection display
 */
function updatePeerConnection(message, type = 'info') {
    if (peerConnection) {
        const iconClass = type === 'success' ? 'fa-check-circle text-success' :
            type === 'warning' ? 'fa-exclamation-triangle text-warning' :
                type === 'danger' ? 'fa-times text-danger' :
                    'fa-info-circle text-info';

        peerConnection.innerHTML = `<i class="fas ${iconClass} me-2"></i>${message}`;
    }
}

/**
 * Update transfer status display
 */
function updateTransferStatus(message, type = 'info') {
    if (transferStatus) {
        const iconClass = type === 'success' ? 'fa-check-circle text-success' :
            type === 'warning' ? 'fa-exclamation-triangle text-warning' :
                type === 'danger' ? 'fa-times text-danger' :
                    'fa-info-circle text-info';

        transferStatus.innerHTML = `<i class="fas ${iconClass} me-2"></i>${message}`;
    }
}

/**
 * Update progress bar and text
 */
function updateProgress(percentage) {
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = `True P2P Progress: ${Math.round(percentage)}%`;
    }
}

/**
 * Copy shareable URL to clipboard
 */
function copyUrl() {
    shareUrl.select();
    document.execCommand('copy');
    alert('URL copied to clipboard!');
}

/**
 * Reset form to initial state
 */
function resetForm() {
    console.log('True P2P Upload: Resetting form');

    // Reset variables
    selectedFiles = [];
    trueP2P = null;
    transferId = null;

    // Reset file input
    fileInput.value = '';

    // Hide sections
    webrtcStatus.style.display = 'none';
    progressSection.style.display = 'none';
    peerStatus.style.display = 'none';
    shareResult.style.display = 'none';

    // Reset buttons
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<i class="fas fa-rocket me-2"></i>Start Direct P2P Sharing';
    uploadBtn.classList.remove('btn-info');
    uploadBtn.classList.add('btn-success');
    resetBtn.style.display = 'none';

    // Reset progress
    updateProgress(0);

    console.log('True P2P Upload: Form reset completed');
}

/**
 * Show error message to user
 */
function showError(message) {
    console.error('True P2P Upload: Error:', message);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger mt-3';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${message}
    `;

    const cardBody = document.querySelector('.card-body');
    cardBody.appendChild(errorDiv);

    // Remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

/**
 * Cleanup on page unload
 * Cleans up protocol resources
 */
window.addEventListener('beforeunload', () => {
    console.log('True P2P Upload: Cleaning up on page unload');

    if (trueP2P) {
        trueP2P.cleanup();
    }

    if (socket) {
        socket.disconnect();
    }
});
