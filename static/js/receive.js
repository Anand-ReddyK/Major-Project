/**
 * True P2P Receive Page JavaScript
 * 
 * This module handles the file download process using the True P2P Protocol.
 * It provides functionality for:
 * - WebRTC connection establishment
 * - Direct peer-to-peer file download
 * - File reconstruction from chunks
 * - Progress tracking and status updates
 * - Error handling and recovery
 * 
 * The implementation uses WebRTC DataChannels for direct communication
 * between browsers without server storage of file data.
 */

// Global variables for True P2P functionality
let trueP2P = null;
let transferData = null;
let transferId = null;
let downloadedFile = null;
let socket = null;

// DOM elements
const loadingState = document.getElementById('loadingState');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileType = document.getElementById('fileType');
const chunkInfo = document.getElementById('chunkInfo');
const webrtcStatus = document.getElementById('webrtcStatus');
const connectionStatus = document.getElementById('connectionStatus');
const dataChannelStatus = document.getElementById('dataChannelStatus');
const progressSection = document.getElementById('progressSection');
const progressBar = document.querySelector('.progress-bar');
const progressText = document.getElementById('progressText');
const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');
const downloadComplete = document.getElementById('downloadComplete');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');

/**
 * Initialize the True P2P receive page
 * Sets up the protocol and starts the download process
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log('True P2P Receive: Page initialized');

    // Get transfer data from global variables set by server
    transferData = window.transferData;
    transferId = window.transferId;

    if (!transferData || !transferId) {
        showError('No transfer data provided');
        return;
    }

    console.log('True P2P Receive: Transfer ID:', transferId);
    console.log('True P2P Receive: Transfer Data:', transferData);

    // Initialize WebSocket connection and start download
    initializeWebSocket();
});

/**
 * Initialize WebSocket connection for signaling
 * Sets up Socket.IO connection for WebRTC signaling
 */
function initializeWebSocket() {
    try {
        console.log('True P2P Receive: Initializing WebSocket connection');
        socket = io();

        socket.on('connect', () => {
            console.log('True P2P Receive: WebSocket connected');

            // Join transfer room for signaling
            socket.emit('join_transfer_room', { transferId: transferId });
        });

        socket.on('disconnect', () => {
            console.log('True P2P Receive: WebSocket disconnected');
        });

        socket.on('joined_room', (data) => {
            console.log('True P2P Receive: Joined room:', data.transferId);

            // Initialize true P2P protocol after joining room
            initializeTrueP2P();

            // If no offer received within 2 seconds, request one
            setTimeout(() => {
                if (trueP2P && !trueP2P.offerReceived) {
                    console.log('True P2P Receive: No offer received, requesting from sender');
                    socket.emit('request_offer', { transferId: transferId });
                }
            }, 2000);
        });

        socket.on('webrtc_offer', (data) => {
            console.log('True P2P Receive: Received WebRTC offer');
            if (trueP2P) {
                trueP2P.handleWebRTCOffer(data.offer, data.senderSid);
            }
        });

        socket.on('webrtc_ice_candidate', (data) => {
            console.log('True P2P Receive: Received ICE candidate');
            if (trueP2P) {
                trueP2P.handleICECandidate(data.candidate);
            }
        });

        // Store socket globally for protocol use
        window.socket = socket;

    } catch (error) {
        console.error('True P2P Receive: Error initializing WebSocket:', error);
        showError('Failed to initialize WebSocket connection');
    }
}

/**
 * Initialize True P2P protocol and start download
 * Sets up the protocol and begins the download process
 */
async function initializeTrueP2P() {
    try {
        console.log('True P2P Receive: Initializing True P2P protocol');

        // Initialize protocol
        trueP2P = new TrueP2PProtocol(transferId, false);
        console.log('True P2P Receive: Protocol initialized');

        // Set file metadata
        trueP2P.file = {
            name: transferData.metadata.name,
            size: transferData.metadata.size,
            type: transferData.metadata.type
        };
        trueP2P.totalChunks = transferData.metadata.totalChunks;

        console.log('True P2P Receive: File metadata set');
        console.log('True P2P Receive: File name:', trueP2P.file.name);
        console.log('True P2P Receive: File size:', trueP2P.file.size);
        console.log('True P2P Receive: Total chunks:', trueP2P.totalChunks);

        // Display file information
        displayFileInfo();

        // Update status
        updateConnectionStatus('WebRTC connection initializing...', 'warning');
        updateDataChannelStatus('Setting up data channel...', 'warning');

        // Show status sections
        loadingState.style.display = 'none';
        fileInfo.style.display = 'block';
        webrtcStatus.style.display = 'block';
        progressSection.style.display = 'block';

        // Start connection monitoring
        startConnectionMonitoring();

    } catch (error) {
        console.error('True P2P Receive: Error initializing protocol:', error);
        showError('Failed to initialize True P2P protocol: ' + error.message);
    }
}

/**
 * Display file information
 * Shows details about the file being downloaded
 */
function displayFileInfo() {
    console.log('True P2P Receive: Displaying file information');

    if (fileName) fileName.textContent = trueP2P.file.name;
    if (fileSize) fileSize.textContent = formatFileSize(trueP2P.file.size);
    if (fileType) fileType.textContent = getFileType(trueP2P.file.name);
    if (chunkInfo) chunkInfo.textContent = `File split into ${trueP2P.totalChunks} chunks for P2P transfer`;

    console.log('True P2P Receive: File information displayed');
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
                clearInterval(monitorInterval);
            } else if (trueP2P.status === 'failed') {
                updateConnectionStatus('Connection failed', 'danger');
                updateDataChannelStatus('Data channel failed', 'danger');
            }
        }
    }, 2000);
}

/**
 * Download the prepared file
 * Triggers browser download
 */
function downloadFile() {
    if (!downloadedFile) {
        alert('File not ready for download yet');
        return;
    }

    console.log('True P2P Receive: Downloading file');

    try {
        // Create download link
        const url = URL.createObjectURL(downloadedFile);
        const a = document.createElement('a');
        a.href = url;
        a.download = trueP2P.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('True P2P Receive: File download triggered');

        // Update UI
        downloadBtn.innerHTML = '<i class="fas fa-check me-2"></i>Downloaded';
        downloadBtn.disabled = true;
        downloadBtn.classList.remove('btn-primary');
        downloadBtn.classList.add('btn-secondary');

        // Show completion
        downloadSection.style.display = 'none';
        downloadComplete.style.display = 'block';

    } catch (error) {
        console.error('True P2P Receive: Error downloading file:', error);
        showError('Failed to download file: ' + error.message);
    }
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
 * Update progress bar and text
 */
function updateProgress(percentage) {
    if (progressBar) {
        progressBar.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = `True P2P Download: ${Math.round(percentage)}%`;
    }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file type from filename
 */
function getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const typeMap = {
        'jpg': 'JPEG Image',
        'jpeg': 'JPEG Image',
        'png': 'PNG Image',
        'gif': 'GIF Image',
        'pdf': 'PDF Document',
        'txt': 'Text File',
        'mp4': 'MP4 Video',
        'mp3': 'MP3 Audio',
        'zip': 'ZIP Archive',
        'doc': 'Word Document',
        'docx': 'Word Document'
    };
    return typeMap[extension] || 'Unknown Type';
}

/**
 * Show error message to user
 */
function showError(message) {
    console.error('True P2P Receive: Error:', message);

    loadingState.style.display = 'none';
    errorState.style.display = 'block';
    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

/**
 * Cleanup on page unload
 * Cleans up protocol resources
 */
window.addEventListener('beforeunload', () => {
    console.log('True P2P Receive: Cleaning up on page unload');

    if (trueP2P) {
        trueP2P.cleanup();
    }

    if (socket) {
        socket.disconnect();
    }
});
