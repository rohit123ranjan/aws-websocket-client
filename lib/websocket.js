class AwsWebSocketWrapper{
    constructor(url, config = {}){
        const {
            messageChannel = 'message', // Default AWS Message handler
            debug = false,
            wsConfig =  { } ,  // websocket configuration
            restartMax = 0, // Maximum retries to connect to websocket server, if fails then clear websocket [0 means infinite]
            reconnectTime = 3 * 1000, // Every 3 seconds
        } = config;
        this.url = url;
        this.wsConfig = typeof(wsConfig) !== "string" ? null : wsConfig;
        this.debug = debug;
        this.socket = {};
        this.socketConnected = false;
        this._events = [];
        this.messageChannel = messageChannel; // Message channel
        this.restartNum  =  0 ;  // current number of restarts
        this.socketIsClose  =  false ;  // Has it been completely closed
        this.reconnectTime = reconnectTime; // try to reconnect after given time, 0 for infinite
        this.restartMax = restartMax;
    }

    dispatch(event, data) {
      if (!this._events[event]) return;
      this._events[event].forEach(callback => callback(data))
    }

    on(event, callback) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(callback);
    }

    connect(){
        try {
            if(typeof(WebSocket) !== "undefined"){
                this.socket = this.wsConfig!== null ? new WebSocket(this.url, this.wsConfig): new WebSocket(this.url);
                this.websocketInit();
            }else{
                console.log("Websocket is not supported in this browser.");
            }
        } catch (e) {
            console.log('catch', e);
            this.websocketReconnect();
        }
    }

    emitOnMain(event, data){
        let tmpData = {
            event: event,
            body: data,
        }
        this.socket.send(JSON.stringify({action: this.messageChannel, data: tmpData}));
    }

    emitToHandler(event, data, handler){
        let tmpData = {
            event: event,
            body: data,
        }
        this.socket.send(JSON.stringify({action: handler, data: tmpData}));
    }

    emit(event, data, handler){
        if(!this.socketConnected)
            this.websocketReconnect();
        (typeof(handler) === "undefined") ? this.emitOnMain(event, data) : this.emitToHandler(event, data, handler);
    }

    websocketInit () {
        const onOpen = () => {
            if(this.debug)
            console.log("Socket Connected");
            this.socketConnected = true;
            this.restartNum = 0;
        }
        const onError = (err) => {
            if(this.debug)
            console.log("Socket Error: ", err);
        }
        const onClose = (e) => {
            if(this.debug)
            console.log("Socket Connection Closed:- ", this.socket.readyState);
        }
    
        const onMessageWeb = (res) => {
            if(typeof(res.data) === "undefined"){
                return; //missing data
            }
            if(this.debug)
            console.log("Socket Response: ", res.data)
            const data = JSON.parse(res.data);
            this.dispatch(data.event, data.body);
        }

        if(typeof(WebSocket) !== "undefined") {
            this.socket.onopen = onOpen;
            this.socket.onerror = onError;
            this.socket.onclose = onClose;
            this.socket.onmessage = onMessageWeb;
        }
    }

    websocketReconnect() {
        if (this.lockReconnect || this.socketIsClose) {
            return;
        }else if(this.restartNum >= this.restartMax && this.restartMax > 0) {
            this.socketIsClose = true;
            return;
        }
        this.restartNum++;
        if(this.debug)
        console.log('Socket Restart Count: ', this.restartNum);
        this.lockReconnect = true;
        this.timeout && clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.connect();
            this.lockReconnect = false;
        }, this.reconnectTime);
    }

    disconnect(){
        try {
            if(this.debug)
            console.log('Closing socket connection...');
            // close retry attempt
            this.socketIsClose = true;
            this.socket.close();
            if(this.debug)
            console.log('Socket Disconnected');
        } catch (e) {
            console.log('Unable to disconnect', e);
        }
    }

}

export default AwsWebSocketWrapper;