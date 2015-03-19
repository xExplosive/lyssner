var io = require('socket.io'),
    connect = require('connect');

// required to set up custom event emitters.
// this event emitter uses an emit method that is
// unrelated to the socket.io emit method, because
// the events are only sent and received internally
var util = require('util');
var EventEmitter = require('events').EventEmitter;

// more custom event setup.
// this is the CONSTRUCTOR
var PartnerListener = function () {
    this.wakeUp = function ( partnerSocket ) {
        this.emit('wakeUp', partnerSocket );
    }
}
util.inherits( PartnerListener, EventEmitter );

var app = connect().use(connect.static('public')).listen(80);
var chat_room = io.listen(app);

var venters = [];
var listeners = [];

chat_room.sockets.on('connection', function (socket) {
    socket.on('identify', function(data) {
        // venters are true
        // listeners are false
        chattype = data.chattype;

        // who are we chatting with
        var partner;

        // check the opposite queue. if someone is waiting, match them.
        if ( ( chattype ? listeners : venters ).length > 0 ){
            // get the first partner from the array, assign it, and slice it
            // FIFO FTW
            queuedPartner = ( chattype ? listeners : venters ).shift();
            partner = queuedPartner.partnerSocket
            socket.emit('entrance', {
                message: "You're now connected to a " + (!chattype ? 'venter' : 'listener') + "."
            });
            // now we can set up actual chat events.
            setUpChatEvents();

            // and let our partner know to set up actual chat events.
            // wakeUp() forces the wakeup event on the listener object
            queuedPartner.partnerListener.wakeUp( socket );
        } else {
            // if no one is waiting, we add a custom event listener so we know when we're matched with a partner.
            var partnerListener = new PartnerListener();
            // then we add ourselves to the queue, sending a reference to the event listener with it
            ( chattype ? venters : listeners ).push({ 'partnerSocket': socket, 'partnerListener': partnerListener });
            socket.emit('entrance', {
                message: "We're finding you a " + ( !chattype ? 'venter' : 'listener' ) + "."
            });

            partnerListener.once('wakeUp', function ( partnerSocket ) {
                partner = partnerSocket;
                socket.emit('foundpartner', {
                    message: "You're now connected to a " + (chattype ? 'venter' : 'listener') + "."
                });
                setUpChatEvents();
            });

        }

        // relies on partner being in scope
        function setUpChatEvents() {
            
            

            socket.on('chat', function (data) {
                partner.emit('chat', {
                    message: data.message
                });
            });

            socket.on('typing', function (data) {
                partner.emit('is typing', {
                    message: data.message
                });
            });

            socket.on('clearedtextfield', function () {
                partner.emit('clearedtextfield');
            });

            socket.on('stoppedtyping', function (data) {
                partner.emit('stopped', {
                    message: data.message
                });
            });
        }
    });

    socket.on('disconnect', function () {
        socket.broadcast.emit('exit', {
            message: 'Your partner has disconnected.'
        });
    });
});