# True P2P File Sharing Application (Direct WebRTC)

A true peer-to-peer file sharing system using WebRTC DataChannels for direct communication between browsers. The server only acts as a signaling server to facilitate WebRTC connection establishment, with no file data passing through the server.

## 🚀 Overview

The True P2P application implements direct peer-to-peer file sharing using WebRTC DataChannels. This approach provides the highest level of privacy and true P2P communication while maintaining the reliability of WebRTC for NAT traversal and connection establishment.

## 🛠️ Technology Stack

- **Backend**: Flask, Flask-SocketIO (signaling only)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **P2P Protocol**: WebRTC DataChannels
- **Signaling**: WebSocket (Socket.IO)
- **NAT Traversal**: STUN servers
- **Styling**: Bootstrap 5, Font Awesome icons

## 📁 Project Structure

```
.
├── app.py                 # Main Flask application with 
├── templates/
│   ├── upload.html        # File upload interface
│   └── receive.html       # File download interface
├── static/
│   ├── js/
│   │   ├── protocol.js    # True P2P protocol implementation
│   │   ├── upload.js      # Upload page JavaScript
│   │   └── receive.js     # Download page JavaScript
│   └── css/
│       └── style.css      # Application styles
├── requirements.txt       # Python dependencies for this repo
├── .gitignore             # Git ignore rules
└── README.md              # This documentation
```

## 🔧 How It Works

### Upload Process

1. **File Selection**: User selects files to share
2. **Protocol Initialization**: True P2P protocol is initialized
3. **File Chunking**: Files are split into chunks for transfer
4. **WebRTC Setup**: RTCPeerConnection is established
5. **Data Channel Creation**: WebRTC DataChannel is created
6. **Signaling**: Server facilitates WebRTC connection establishment
7. **Direct Transfer**: File chunks are sent directly to peer
8. **Shareable URL**: A shareable URL is generated for distribution

### Download Process

1. **Magnet URI Access**: User accesses the shareable URL
2. **Metadata Retrieval**: Transfer metadata is retrieved from server
3. **Protocol Initialization**: True P2P protocol is initialized
4. **WebRTC Setup**: RTCPeerConnection is established
5. **Data Channel Setup**: WebRTC DataChannel is configured
6. **Signaling**: Server facilitates WebRTC connection establishment
7. **Direct Download**: File chunks are received directly from peer
8. **File Reconstruction**: Chunks are reassembled into original file
9. **Progress Tracking**: Real-time progress updates are displayed
10. **File Download**: Reconstructed file is made available for download

## 🌐 API Endpoints

### Main Routes

- `GET /` - Upload page interface
- `GET /share/<transfer_id>` - Download page interface

### API Endpoints

- `POST /api/create-transfer` - Create new transfer
- `GET /api/transfer/<transfer_id>` - Get transfer information
- `POST /api/cleanup` - Clean up expired transfers

### WebSocket Events

- `join_transfer_room` - Join transfer room for signaling
- `webrtc_offer` - WebRTC offer for peer connection
- `webrtc_answer` - WebRTC answer for peer connection
- `webrtc_ice_candidate` - ICE candidate for NAT traversal
- `request_offer` - Request WebRTC offer from sender
- `peer_joined` - Notify when peer joins room
- `offer_requested` - Notify when offer is requested

## 🔄 Data Flow

```
Uploader                    Server                    Downloader
   |                          |                          |
   |-- Select Files --------->|                          |
   |                          |                          |
   |-- Initialize Protocol -->|                          |
   |                          |                          |
   |-- Chunk Files ---------->|                          |
   |                          |                          |
   |-- Setup WebRTC --------->|                          |
   |                          |                          |
   |-- Create Data Channel -->|                          |
   |                          |                          |
   |-- Join Signaling Room -->|                          |
   |                          |                          |
   |-- Generate Share URL --->|                          |
   |                          |                          |
   |                          |<-- Access Share URL -----|
   |                          |                          |
   |                          |-- Return Metadata ------->|
   |                          |                          |
   |                          |<-- Join Signaling Room --|
   |                          |                          |
   |<-- WebRTC Signaling ------------------------------->|
   |                                                     |
   |<-- Direct P2P Transfer ---------------------------->|
   |                                                     |
   |<-- File Transfer Complete-------------------------->|
```

## 🎯 Key Features

### Upload Features

- **Direct P2P Transfer**: Files sent directly between peers
- **WebRTC DataChannels**: High-performance data transfer
- **NAT Traversal**: Automatic NAT traversal with STUN servers
- **File Chunking**: Efficient chunk-based transfer
- **Progress Tracking**: Real-time transfer progress
- **Shareable URLs**: Easy sharing via generated URLs

### Download Features

- **Direct P2P Download**: Files received directly from peers
- **WebRTC DataChannels**: Reliable data channel communication
- **File Reconstruction**: Automatic file assembly from chunks
- **Progress Tracking**: Real-time download progress
- **Direct Download**: Browser-based file download
- **Error Handling**: Comprehensive error management

### Technical Features

- **True P2P**: No server storage of file data
- **WebRTC Signaling**: Server only for connection establishment
- **STUN Servers**: NAT traversal support
- **Data Channel Management**: Reliable data transfer
- **Connection Monitoring**: Real-time connection status
- **Resource Cleanup**: Automatic cleanup of resources

## 🔧 Configuration

### WebRTC Configuration

```javascript
const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const dataChannelConfig = {
    ordered: true,
    maxRetransmits: 3
};
```

### Server Configuration

```python
# SocketIO configuration
socketio = SocketIO(app, cors_allowed_origins="*")

# Transfer cleanup settings
CLEANUP_INTERVAL = 86400  # 24 hours in seconds
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB limit
```

## 🚀 Getting Started

### Prerequisites

- Python 3.7+
- Flask, Flask-SocketIO
- Modern web browser with WebRTC support

### Installation

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Application**
   ```bash
   python app.py
   ```

3. **Access the Application**
   - Open `http://localhost:5004` in your browser
   - Start uploading and sharing files!

### Usage

1. **Upload Files**
   - Select files using the file input
   - Click "Start Direct P2P Sharing"
   - Wait for WebRTC connection establishment
   - Copy the shareable URL

2. **Download Files**
   - Open the shareable URL
   - Wait for WebRTC connection establishment
   - Monitor download progress
   - Click "Download File" when complete

## 📊 Monitoring and Logging

### Console Logging

The application provides comprehensive logging for debugging and monitoring:

```
True P2P Upload: Page initialized
True P2P Upload: Files selected: 1
True P2P Upload: Generated transfer ID: true-p2p-1234567890-abc123
True P2P Upload: Protocol initialized
True P2P Upload: File set for processing: example.jpg (1024000 bytes)
True P2P Upload: File split into 16 chunks
True P2P Upload: WebRTC connection ready
True P2P Upload: Data channel ready for P2P transfer
True P2P Upload: Shareable URL generated
```

### Progress Tracking

- **Upload Progress**: Direct P2P transfer progress
- **Download Progress**: Real-time download percentage
- **WebRTC Status**: Connection and data channel status
- **Peer Status**: Peer connection monitoring

## 🔒 Security Considerations

### Privacy

- **No Server Storage**: Files never stored on server
- **Direct P2P**: Direct communication between peers
- **End-to-End**: Data encrypted by WebRTC

### Network Security

- **STUN Servers**: Trusted STUN servers for NAT traversal
- **WebRTC Security**: Built-in WebRTC security features
- **HTTPS**: Use HTTPS in production

## 🐛 Troubleshooting

### Common Issues

1. **WebRTC Connection Fails**
   - Check browser WebRTC support
   - Verify STUN server connectivity
   - Check firewall settings

2. **Data Channel Not Opening**
   - Check WebRTC connection state
   - Verify peer connection establishment
   - Check console for errors

3. **File Transfer Stalls**
   - Check network connectivity
   - Verify peer connection status
   - Check data channel state

### Debug Mode

Enable debug logging by setting:
```python
socketio.run(app, debug=True)
```

## 🔄 Maintenance

### Regular Tasks

1. **Cleanup Expired Transfers**
   - Automatic cleanup every 24 hours
   - Manual cleanup via API endpoint

2. **Monitor Performance**
   - Track transfer statistics
   - Monitor WebRTC connections
   - Check error logs

3. **Update Dependencies**
   - Keep Flask-SocketIO updated
   - Update frontend dependencies
   - Test WebRTC compatibility

## 📈 Performance Optimization

### Client-Side

- **Chunk Size**: Optimize chunk size for network conditions
- **Data Channel**: Configure data channel parameters
- **Memory Management**: Proper cleanup of resources

### Server-Side

- **Signaling**: Optimize WebSocket signaling
- **STUN Servers**: Use reliable STUN servers
- **Load Balancing**: Use load balancer for high traffic

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- Follow PEP 8 for Python code
- Use ES6+ for JavaScript
- Add comprehensive comments
- Include error handling

## 📄 License

This project is for educational and demonstration purposes. The WebRTC implementation uses standard browser APIs.

## 🔗 Resources

- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Flask-SocketIO Documentation](https://flask-socketio.readthedocs.io/)
- [STUN Server List](https://gist.github.com/zziuni/3741933)
- [WebRTC DataChannels](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel)

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review console logs
3. Check WebRTC support
4. Verify network connectivity

---

**Note**: This application demonstrates true peer-to-peer file sharing using WebRTC. For production use, additional security measures and optimizations should be implemented.

## 🧩 Repository Setup

This repository is self-contained. Clone it and run locally with Python.

### Requirements

- Python 3.8+
- Modern browser with WebRTC support

### Quickstart (Windows PowerShell)

```powershell
# Optional: create and activate a virtual environment
python -m venv venv
./venv/Scripts/Activate.ps1

# Install deps
pip install -r requirements.txt

# Run
python app.py
```


### Publish to GitHub

```bash
git init
git add .
git commit -m "Initial commit: True P2P (WebRTC) app"
# Create a repo on GitHub and set its URL here:
git remote add origin <your_repo_url>
git branch -M main
git push -u origin main
```

### What’s Included Here

- `app.py`: Flask + Socket.IO signaling server (no file data on server)
- `templates/`: Upload and Receive pages
- `static/js/`: WebRTC protocol, upload/receive logic
- `static/css/`: Styles for the app
- `requirements.txt`: Only the dependencies this app needs
- `.gitignore`: Python/venv/OS junk ignored
- `run.ps1`, `run.bat`: One-command local runners (optional)
