$(document).ready(()=>{
    const ss=ScreenShare.create({debug:true});

    let peer=null;
    let screensharepeer=null;
    let room=null;
    let screenshareroom=null;
    let localStream=null;
    let localScreenStream=null;
    let screensharinguserid='';
    let remoteStreams={};
    let userdata={
        username:'',
        usericon:null
    };
    let usersdata={};
    let roomname='';

    $('#usernameipt').val(localStorage.getItem('username'));

    $.getJSON('/js/apikey.json',(data)=>{
        peer=new Peer({
            key:data.key,
            debug:3
        });
        peer.on('open',id=>{
            $('#status-icon').removeClass('status-icon-offline');
            $('#status-icon').addClass('status-icon-online');
            $('#skyway-statustxt').text('SkyWay Status : online');
        });
        peer.on('disconnected',()=>{
            $('#status-icon').addClass('status-icon-offline');
            $('#status-icon').removeClass('status-icon-online');
            $('#skyway-statustxt').text('SkyWay Status : offline');
        });

        screensharepeer=new Peer({
            key:data.key,
            debug:3
        });
    });
    $('#usericonpit').on('change',e=>{
        let file=e.target.files[0];
        userdata.usericon=file;
        $('#localusericon').attr('src',URL.createObjectURL(file));
        $('#localusericon').on('load',()=>{
            if($('#localusericon').get(0).width>256||$('#localusericon').get(0).height>256){
                swal({
                    title: 'Icon Size Error!',
                    text: 'Please use images of 256px or less in height and width.',
                    icon: 'error',
                });
                userdata.usericon=null;
                $('#localusericon').attr('src','./img/usericon.png');
            }
            if($('#localusericon').get(0).width!==$('#localusericon').get(0).height){
                swal({
                    title: 'Icon Size Error!',
                    text: 'Please use square image',
                    icon: 'error',
                });
                userdata.usericon=null;
                $('#localusericon').attr('src','./img/usericon.png');
            }
        });
    });
    $('#joinroombtn').on('click',()=>{
        roomname=$('#roomnameipt').val();
        let username=$('#usernameipt').val();
        localStorage.setItem('username',username);
        userdata.username=username;
        usersdata[peer.id]=userdata;
        $('#localusername').text(username?username:peer.id);
        if(roomname){
            $('#roomnametxt').text(`Room : ${roomname}`);
            $('#joinroom').toggle();
            $('#chat').toggle();

            navigator.mediaDevices.getUserMedia({video:false,audio:true})
            .then(stream=>{
                localStream=stream;
                $('#myvideo').get(0).srcObject=stream;
                room=peer.joinRoom(roomname,{mode:'sfu',stream:stream});
                userdata.username=username;
                connect(room,true);
            })
            .catch(e=>{
                swal({
                    title: 'getUserMedia Error!',
                    text: `Please check your microphone.\n${e.toString()}`,
                    icon: 'error',
                });
            });
        }
    });
    $('#leaveroombtn').on('click',()=>{
        room.close();
        room=null;
        localStream.getTracks().forEach(track => track.stop());
        localStream=null;
        ss.stop();
        localScreenStream=null;
        userdata={};
        usersdata={};
        $('#myvideo').get(0).srcObject=null;
        removeChatUserElms();
        $('#joinroom').toggle();
        $('#chat').toggle();
    });
    $('#local-mutebtn').on('click',()=>{
        if($('#local-mutebtn').text()==='Mute'){
            localStream.getTracks().forEach(track=>track.enabled=false);
            $('#local-mutebtn').text('Unmute');
        }else{
            localStream.getTracks().forEach(track=>track.enabled=true);
            $('#local-mutebtn').text('Mute');
        }
    });
    $('#screensharebtn').on('click',()=>{
        if(!localScreenStream){
            ss.start().then(stream=>{
                $('#myscreen').get(0).srcObject=stream;
                localScreenStream=stream;
                screenshareroom=screensharepeer.joinRoom(roomname,{mode:'sfu',stream:stream});
                connect(screenshareroom,false);
            });
            $('#screensharebtn').text('Screen Share Stop');
        }else{
            ss.stop();
            screenshareroom.close();
            screenshareroom=null;
            localScreenStream.getTracks().forEach(track=>{
                track.stop();
            });
            $('#myscreen').get(0).srcObject=null;
            localScreenStream=null;
            $('#screensharebtn').text('Screen Share Start').toggle();
        }
    });

    let connect=(_room,isUser)=>{
        _room.on('open',()=>{
            if(isUser){
                _room.send(userdata);
            }
        });
        _room.on('stream',stream=>{
            if(stream.getAudioTracks()[0]&&isUser){
                addChatUserElm(stream.peerId);
                _room.send(userdata);
                remoteStreams[stream.peerId]=stream;
                $(`#${stream.peerId}-video`).get(0).srcObject=stream;
                $(`#${stream.peerId}-video`).get(0).play();
            }else{
                screensharinguserid=stream.peerId;
                $('#myscreen').get(0).srcObject=stream;
                $('#myscreen').get(0).play();
                if(!localScreenStream){
                    $('#screensharebtn').toggle();
                }
            }
        });
        _room.on('removeStream', stream => {
            console.log(stream);
        });
        _room.on('data',msg=>{
            if(isUser){
                console.log(msg);
                if(msg.data.username){
                    usersdata[msg.src]={
                        username:msg.data.username,
                        usericon:msg.data.usericon
                    };
                    $(`#${msg.src}-name`).text(msg.data.username);
                    if(msg.data.usericon){
                        setTimeout(()=>{
                            const dataView = new Uint8Array(msg.data.usericon);
                            const dataBlob = new Blob([dataView]);
                            const url = URL.createObjectURL(dataBlob);
                            $(`#${msg.src}-icon`).attr('src',url);
                        },500);
                    }
                }
            }
        });
        _room.on('peerJoin',id=>{
            console.log(id);
        });
        _room.on('peerLeave',id=>{
            console.log(id);
            if(isUser){
                remoteStreams[id]=null;
                usersdata[id]=null;
                removeChatUserElm(id);
            }
            if(id===screensharinguserid){
                $('#myscreen').get(0).srcObject=null;
                $('#screensharebtn').toggle();
                screensharinguserid='';
            }
        });
    };
    let addChatUserElm=(id)=>{
        let _elm=`
        <div id="${id}" class="col-md-3 chat-user active-user">
            <p id="${id}-name" class="modal-title">${(usersdata[id]?usersdata[id].username:id)}</p>
            <img id="${id}-icon" class="img-thumbnail user-icon" src="./img/usericon.png">
            <video id="${id}-video" autoplay></video>

            <div class="text-center control-btn">
                <button id="${id}-mutebtn" class="btn btn-secondary">Mute</button>
            </div>
        </div>`;

        $('#chat-users').append(_elm);

        $(`#${id}-mutebtn`).on('click',()=>{
            if($(`#${id}-mutebtn`).text()==='Mute'){
                remoteStreams[id].getTracks().forEach(track=>track.enabled=false);
                $(`#${id}-mutebtn`).text('Unmute');
                $(`#${id}`).removeClass('active-user');
                $(`#${id}`).addClass('mute-user');
            }else{
                remoteStreams[id].getTracks().forEach(track=>track.enabled=true);
                $(`#${id}-mutebtn`).text('Mute');
                $(`#${id}`).removeClass('mute-user');
                $(`#${id}`).addClass('active-user');
            }
        })
    };

    let removeChatUserElm=(id)=>{
        $(`#${id}`).remove();
    }

    let removeChatUserElms=()=>{
        let elms=$('.chat-user');
        for(let i=0;i<elms.length;i++){
            if(elms[i].className.indexOf('local-user')===-1){
                elms[i].remove();
            }
        }
    };
});