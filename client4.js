const socket = io();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peerConnection = new RTCPeerConnection(configuration);
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
let localStream;
let isMuted = false;
let mediaRecorder;
let recordedChunks = [];
let mimeType;
let fileExtension;

// Offer/Answer and ICE Candidate handling
function selectTargetSocketId() {
    const userList = document.getElementById('userList');
    const selectedSocketId = userList.options[userList.selectedIndex].value;
    if (selectedSocketId !== socket.id) {
        targetSocketId = selectedSocketId;
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('send-offer', targetSocketId, peerConnection.localDescription);
            });
    } else {
        alert('You cannot call yourself!');
    }
}

socket.on('receive-offer', (offererSocketId, offer) => {
    targetSocketId = offererSocketId;
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('send-answer', targetSocketId, peerConnection.localDescription);
        });
});

socket.on('receive-answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('receive-ice-candidate', (iceCandidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate));
});

// WebRTC Video streams
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;  // Store the stream in a global variable
        localVideo.srcObject = stream;
        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

        // MediaRecorder initialization
        mimeType = 'video/webm;codecs=h264';
        fileExtension = '.webm';
        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        mediaRecorder.ondataavailable = function(event) {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = async function() {
            const blob = new Blob(recordedChunks, { type: mimeType });
            await uploadVideo(blob, fileExtension);
            recordedChunks = [];
        };
        mediaRecorder.start();
    })
    .catch((error) => console.error(error));

function toggleMute() {
    if (!localStream) {
        console.error('No local stream available');
        return;
    }
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        console.error('No audio tracks available');
        return;
    }
    isMuted = !isMuted;
    audioTracks[0].enabled = !isMuted;
    document.getElementById('muteButton').textContent = isMuted ? 'Unmute' : 'Mute';
}

function hangup() {
    mediaRecorder.stop();
    peerConnection.close();
    document.getElementById('userList').selectedIndex = -1;
}

async function uploadVideo(blob, extension) {
    const formData = new FormData();
    formData.append('video', blob, `video${extension}`);
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        console.log('Video uploaded successfully:', data);
    } catch (error) {
        console.error('Error uploading video:', error);
    }
}

socket.on('user-connected', (data) => {
    const userList = document.getElementById('userList');
    userList.innerHTML = data.socketIds.map(socketId =>
        `<option value="${socketId}">${socketId}</option>`
    ).join('');
});

socket.on('user-disconnected', (data) => {
    const userList = document.getElementById('userList');
    userList.innerHTML = data.socketIds.map(socketId =>
        `<option value="${socketId}">${socketId}</option>`
    ).join('');
});

peerConnection.onicecandidate = function(event) {
    if (event.candidate) {
        socket.emit('send-ice-candidate', targetSocketId, event.candidate);
    }
};

peerConnection.ontrack = function(event) {
    remoteVideo.srcObject = event.streams[0];
};
