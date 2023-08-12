let APP_ID = 'f7b086d80d7d46999d997ef56a88121a'

// Rest of your code...


let token = null;
let uid = String(Math.floor(Math.random()*10000))

let connected = {};
let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

let localStream; //our video and audio data
let remoteStream; //remote user's video and audio data
let peerConnection; //core interface to connect to that user


const servers = {
    iceServers:[
        {
            urls:[ 
            'stun:stun3.l.google.com:19302',
            'stun:stun4.l.google.com:19302']
        }
    ]
}

let constraints = {
    video:{
        width:{min:640,ideal:1920,max:1920},
        height:{min:480,ideal:1080,max:1080}
    },
    audio:true
}


let init = async()=>{

    //we have this access due to script which we added
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid,token})

    // Make an API request to the server to check room availability

    const response = await fetch(`https://backend-video-chat-app.onrender.com/checkRoomAvailability?roomId=${roomId}`)

    const data = await response.json();

    if (data.people<2) {
        // User is allowed to join
        channel = client.createChannel(roomId);
        await channel.join();
    } else {
        // Room is full, show an error message
        alert('Room is Full');
        window.location.href = "lobby.html";
        return;
    }
    // Rest of the init function...


// In this updated code, we first check if the connected[roomId] count is already equal to or greater than 2, and if so, we display an alert and prevent further execution of the function. Otherwise, we proceed to create the channel and join it if it hasn't been created yet, and then we increment the connected[roomId] count.
// Make sure you replace the relevant part of your init() function with this updated code. This should prevent more than two members from joining the same room.
// Please note that this code assumes that you have the necessary logic to handle the case when a member leaves the room (handleUserLeft function). If a member leaves, you should decrement the connected[roomId] count to allow another member to join.







    channel.on('MemberJoined',handleuserjoin)
    channel.on('MemberLeft',handleUserLeft)

    client.on('MessageFromPeer',handleMessageFromPeer)
    //this will ask for the permission on localstream user to give access to the camera and microphone
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream

}

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

let handleuserjoin = async (MemberId)=>{
    console.log('New user has joined the chat:',MemberId)
    createoffer(MemberId)
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        createanswer(MemberId, message.offer);
    }
    if (message.type === 'answer') {
        addAnswer(message.answer);
    }if (message.type === 'candidate' && peerConnection.remoteDescription) {
        peerConnection.addIceCandidate(message.candidate);
    }

    console.log('Message:', message, ' -> ', message.type);
};


let createPeerConnection = async(MemberId)=>{
        //peer connection made
        peerConnection = new RTCPeerConnection(servers)
        //media stream is setup
        remoteStream = new MediaStream()
        document.getElementById('user-2').srcObject = remoteStream

        document.getElementById('user-2').style.display = 'block'
        document.getElementById('user-1').classList.add('smallFrame')
    
    
        if(!localStream){
            localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false})
            document.getElementById('user-1').srcObject = localStream 
        }
        // The provided code adds the tracks (such as audio and video tracks) from your local media stream (usually from your camera and microphone) to a WebRTC peer connection. This allows the local camera video and audio to be sent to and received by a remote peer over the WebRTC connection.
        localStream.getTracks().forEach((track)=>{
            peerConnection.addTrack(track,localStream)
        })
    
        //now we also have to hear that peerconnection  by looping and adding through the remote peer
        peerConnection.ontrack = (event) =>{
            event.streams[0].getTracks().forEach((track)=>{
                remoteStream.addTrack(track)
            })
        }
    
        peerConnection.onicecandidate = async (event) =>{
            if(event.candidate){
                // console.log('New ICE Candidate : ',event.candidate)
                // client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':event.candidate})},event.candidate)
                client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId);
    
            }
        }
}
 
let createoffer = async (MemberId) =>{

    await createPeerConnection(MemberId)

    //create offer

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)
    // console.log("Offer : ",offer)

    //this will send the message back to the first peer with the specified Id
    // client.sendMessageToPeer({text:'Hey!!!'},MemberId)


    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId)
}

let createanswer = async(MemberId,offer)=>{
    await createPeerConnection(MemberId)

    await peerConnection.setRemoteDescription(offer)
    let answer = await peerConnection.createAnswer()

    await peerConnection.setLocalDescription(answer)
    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId)
}

// let addAnswer = async (answer) =>{
//     if(!peerConnection.currentRemoteDescription){
//         peerConnection.setRemoteDescription(answer)
//     }
// }

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
    }
};



let leaveChannel = async () =>{
    await channel.leave()
    await client.logout()
    // window.location.href=''
}

let toggleCamera = async() =>{
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')
    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}

let toggleMic = async() =>{
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')
    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249,.9)'
    }
}



//because generally user leaves the laptop shut down or close the window
window.addEventListener('beforeunload',leaveChannel)

document.getElementById('camera-btn').addEventListener('click',toggleCamera)
document.getElementById('mic-btn').addEventListener('click',toggleMic)
// Add this code inside your 'init()' function or wherever appropriate

// Get a reference to the "End Call" button
const endCallButton = document.getElementById('leave-btn');

// Add an event listener to the button
endCallButton.addEventListener('click', async () => {
    // Call the function to end the call
    await endCall();
});

// Function to end the call
const endCall = async () => {
    // Close the WebRTC connection and release resources
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Stop local media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Hide remote video element and reset layout
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');

    // Leave the channel and log out
    await channel.leave();
    await client.logout();


    // Redirect or perform any other necessary actions
    window.location = 'thank.html'; // Example: Redirect to a thank you page
};


init()