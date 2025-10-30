#!/usr/bin/env python3
"""
True P2P File Sharing Application (Direct WebRTC)

This module implements a true peer-to-peer file sharing system using WebRTC DataChannels
for direct communication between browsers. The server only acts as a signaling server
to facilitate WebRTC connection establishment, with no file data passing through the server.

This approach provides the highest level of privacy and true P2P communication while
maintaining the reliability of WebRTC for NAT traversal and connection establishment.

Author: P2P File Sharing Platform
Version: 1.0.0
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import uuid
import time
from datetime import datetime, timedelta

# Initialize Flask application
app = Flask(__name__)
app.secret_key = 'true-p2p-secret-key-2024'

# Initialize SocketIO for WebRTC signaling
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage for true P2P transfers (in production, use a database)
true_p2p_transfers = {}

def cleanup_expired_transfers():
    """Clean up transfers older than 24 hours"""
    current_time = time.time()
    expired_transfers = []
    
    for transfer_id, transfer_data in true_p2p_transfers.items():
        if current_time - transfer_data['created_at'] > 86400:  # 24 hours
            expired_transfers.append(transfer_id)
    
    for transfer_id in expired_transfers:
        del true_p2p_transfers[transfer_id]
        print(f"True P2P: Cleaned up expired transfer {transfer_id}")

@app.route('/')
def index():
    """Main page - True P2P file upload interface"""
    print("True P2P: Main page accessed")
    return render_template('upload.html')

@app.route('/share/<transfer_id>')
def share(transfer_id):
    """File sharing page - True P2P download interface"""
    print(f"True P2P: Share page accessed for transfer {transfer_id}")
    
    if transfer_id not in true_p2p_transfers:
        flash('Transfer not found or expired', 'error')
        return redirect(url_for('index'))
    
    transfer_data = true_p2p_transfers[transfer_id]
    return render_template('receive.html', 
                         transfer_id=transfer_id,
                         transfer_data=transfer_data)

@app.route('/api/create-transfer', methods=['POST'])
def create_transfer():
    """API endpoint to create a new true P2P transfer"""
    try:
        data = request.get_json()
        transfer_id = data.get('transferId')
        metadata = data.get('metadata')
        
        if not transfer_id or not metadata:
            return jsonify({'error': 'Invalid transfer data'}), 400
        
        print(f"True P2P: Creating transfer {transfer_id}")
        print(f"True P2P: File: {metadata.get('name', 'Unknown')} ({metadata.get('size', 0)} bytes)")
        
        # Store transfer metadata
        true_p2p_transfers[transfer_id] = {
            'id': transfer_id,
            'metadata': metadata,
            'created_at': time.time(),
            'status': 'active',
            'peers': []
        }
        
        print(f"True P2P: Transfer created successfully")
        
        return jsonify({
            'success': True,
            'transfer_id': transfer_id,
            'message': 'Transfer created successfully'
        })
        
    except Exception as e:
        print(f"True P2P: Error creating transfer: {str(e)}")
        return jsonify({'error': 'Failed to create transfer'}), 500

@app.route('/api/transfer/<transfer_id>')
def get_transfer(transfer_id):
    """API endpoint to get transfer information"""
    print(f"True P2P: Retrieving transfer info for {transfer_id}")
    
    if transfer_id not in true_p2p_transfers:
        return jsonify({'error': 'Transfer not found'}), 404
    
    transfer_data = true_p2p_transfers[transfer_id]
    print(f"True P2P: Transfer found: {transfer_data['metadata'].get('name', 'Unknown')}")
    
    return jsonify(transfer_data)

@app.route('/api/cleanup', methods=['POST'])
def cleanup_transfers():
    """API endpoint to clean up expired transfers"""
    try:
        cleanup_expired_transfers()
        return jsonify({
            'success': True,
            'message': 'Cleanup completed',
            'active_transfers': len(true_p2p_transfers)
        })
    except Exception as e:
        print(f"True P2P: Error during cleanup: {str(e)}")
        return jsonify({'error': 'Cleanup failed'}), 500

# ============================================================================
# WEBSOCKET HANDLERS FOR TRUE P2P SIGNALING
# ============================================================================

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'True P2P: Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'True P2P: Client disconnected: {request.sid}')

@socketio.on('join_transfer_room')
def handle_join_transfer_room(data):
    """Handle client joining a transfer room for signaling"""
    transfer_id = data.get('transferId')
    if transfer_id:
        join_room(transfer_id)
        print(f'True P2P: Client {request.sid} joined transfer room: {transfer_id}')
        emit('joined_room', {'transferId': transfer_id})
        
        # Notify other clients in the room that a peer joined
        emit('peer_joined', {'transferId': transfer_id}, room=transfer_id, include_self=False)

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    """Handle WebRTC offer for peer connection"""
    transfer_id = data.get('transferId')
    offer = data.get('offer')
    sender_sid = request.sid
    
    print(f'True P2P: WebRTC offer received for transfer {transfer_id} from {sender_sid}')
    
    # Broadcast offer to other clients in the same transfer room
    emit('webrtc_offer', {
        'offer': offer,
        'senderSid': sender_sid,
        'transferId': transfer_id
    }, room=transfer_id, include_self=False)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    """Handle WebRTC answer for peer connection"""
    transfer_id = data.get('transferId')
    answer = data.get('answer')
    sender_sid = data.get('senderSid') # This should be the SID of the original offer sender
    receiver_sid = request.sid
    
    print(f'True P2P: WebRTC answer received for transfer {transfer_id} from {receiver_sid} to {sender_sid}')
    
    # Send answer back to the original sender
    emit('webrtc_answer', {
        'answer': answer,
        'receiverSid': receiver_sid,
        'transferId': transfer_id
    }, to=sender_sid)

@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice_candidate(data):
    """Handle WebRTC ICE candidate for peer connection"""
    transfer_id = data.get('transferId')
    candidate = data.get('candidate')
    sender_sid = request.sid
    
    print(f'True P2P: ICE candidate received for transfer {transfer_id} from {sender_sid}')
    
    # Broadcast ICE candidate to other clients in the same transfer room
    emit('webrtc_ice_candidate', {
        'candidate': candidate,
        'senderSid': sender_sid,
        'transferId': transfer_id
    }, room=transfer_id, include_self=False)

@socketio.on('request_offer')
def handle_request_offer(data):
    """Handle request for WebRTC offer"""
    transfer_id = data.get('transferId')
    requester_sid = request.sid
    
    print(f'True P2P: Offer requested for transfer {transfer_id} from {requester_sid}')
    
    # Notify other clients in the room that an offer is requested
    emit('offer_requested', {'transferId': transfer_id}, room=transfer_id, include_self=False)

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    print("True P2P: 404 error - page not found")
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    print(f"True P2P: 500 error - {str(error)}")
    return render_template('500.html'), 500

if __name__ == '__main__':
    print("True P2P File Sharing Application Starting...")
    print("=" * 50)
    print("Features:")
    print("- Direct WebRTC DataChannels for P2P communication")
    print("- Server only for signaling (no file data)")
    print("- True peer-to-peer file transfer")
    print("- NAT traversal with STUN servers")
    print("- Real-time progress tracking")
    print("=" * 50)
    
    # Clean up expired transfers on startup
    cleanup_expired_transfers()
    
    # Run the application with SocketIO
    socketio.run(app, debug=True, host='0.0.0.0', port=5004)
