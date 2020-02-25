const serialpath = '/dev/ttyACM0';
var opened = false;
var receivecallback = false;
var responsetimer = null;
var cachevalid = false;
var relaypositions = [0, 0, 0, 0, 0, 0, 0, 0];

const SerialPort = require('serialport');
const serialport = new SerialPort(serialpath, {
    baudRate: 115200,
    autoOpen: false,
    rtscts: true
});

const dict = {
    GETSOFTWAREVERSION: Buffer.from('5A', 'hex'),
    GETRELAYSTATES: Buffer.from('5B', 'hex'),
    SETRELAYSTATES: Buffer.from('5C', 'hex'),
    GETDCINPUTVOLTAGE: Buffer.from('5D', 'hex'),
    ALLRELAYSPOSITION1: Buffer.from('64', 'hex'),
    RELAY1POSITION1: Buffer.from('65', 'hex'),
    RELAY2POSITION1: Buffer.from('66', 'hex'),
    RELAY3POSITION1: Buffer.from('67', 'hex'),
    RELAY4POSITION1: Buffer.from('68', 'hex'),
    RELAY5POSITION1: Buffer.from('69', 'hex'),
    RELAY6POSITION1: Buffer.from('6A', 'hex'),
    RELAY7POSITION1: Buffer.from('6B', 'hex'),
    RELAY8POSITION1: Buffer.from('6C', 'hex'),
    ALLRELAYSPOSITION2: Buffer.from('6E', 'hex'),
    RELAY1POSITION0: Buffer.from('6F', 'hex'),
    RELAY2POSITION0: Buffer.from('70', 'hex'),
    RELAY3POSITION0: Buffer.from('71', 'hex'),
    RELAY4POSITION0: Buffer.from('72', 'hex'),
    RELAY5POSITION0: Buffer.from('73', 'hex'),
    RELAY6POSITION0: Buffer.from('74', 'hex'),
    RELAY7POSITION0: Buffer.from('75', 'hex'),
    RELAY8POSITION0: Buffer.from('76', 'hex')
}

process.on('exit', function(err) {
    //console.log(err);
});

serialport.on('error', function (err) {
    opened = false;
    console.trace(err);
});

serialport.on('data', function (data) {
    if(receivecallback) {
        receivecallback(false, data);
        receivecallback = false;
        clearTimeout(responsetimer);
    } else {
        console.log('Unexpected data received:');
        console.log(data);
    }
});

serialport.on('close', function (err) {
    opened = false;
    console.log(err);
});

serialport.on('drain', function () {
    console.log('Called drain event');
});

serialport.on('open', function () {
    opened = true;
    console.log('Port opened event called');
});

var responseTimeout = function() {
    if(receivecallback) {
        receivecallback(false, data);
        receivecallback = false;
    } else {
        console.log('responseTimeout called with no receivecallback set');
    }
}

var openSerialPort = function(portpath, callback) {
    serialport.open(function (err) {
        if (err) {
            console.trace(err);
            callback(err);
        } else {
            opened = true;
            callback(false);
        }
    });
}

var validRelay = function(relay) {
    //console.log(relay);
    if(Number.isInteger(relay)) {
        if(relay > 0 && relay < 9) {
            return true;
        } else {
            false;
        }
    } else {
        return false;
    }
}

var validPosition = function(position) {
    if(position===0 || position===1) {
        return true;
    } else {
        false;
    }
}

var requestRelayPositions = function(callback) {
    if(opened===false) {
        openSerialPort(serialpath, function(err) {
            if(err) {
                callback(err);
            } else {
                requestRelayPositions(callback);
            }
        });
    } else {
        receivecallback = callback;
        serialport.write(dict.GETRELAYSTATES, 'binary', function(err) {
            if(err) {
                console.trace(err);
                callback(err, false);
            } else {
                //callback(false);
                //callback should be triggered by response from serialport
                responsetimer = setTimeout(function() {
                    responseTimeout();
                }, 2000);
            }
        });
    }
}

var getRelayPositions = function(callback) {
    if(cachevalid===true) {
        callback(false, relaypositions);
        //console.log('Using cache');
    } else {
        if(receivecallback) {
            callback('Cannot make requests requiring a response until previous response is received from the board');
        } else {
            requestRelayPositions(function(err, data) {
                if(err) {
                    callback(err, false);
                } else {
                    let b = [];
                    for (var i = 0; i < 8; i++) {
                        b[i] = (data[0] >> i) & 1;
                    }
                    relaypositions = b;
                    //console.log('cache is now valid');
                    cachevalid = true;
                    callback(false, b);
                }
            });
        }
    }
}

var setRelayPosition = function(params, callback) {
    if(opened===false) {
        openSerialPort(serialpath, function(err) {
            if(err) {
                callback(err);
            } else {
                setRelayPosition(params, callback);
            }
        });
    } else {
        if(validRelay(params.relay)) {
            if(validPosition(params.position)) {
                serialport.write(dict['RELAY' + params.relay + 'POSITION' + params.position], 'binary', function(err) {
                    if(err) {
                        console.trace(err);
                        callback(err);
                    } else {
                        relaypositions[params.relay - 1] = params.position;
                        //console.log('Relay:' + (params.relay - 1));
                        //console.log('Position: ' + params.position);
                        //console.log(relaypositions);
                        callback(false);
                    }
                });
            } else {
                callback('Invalid position specified');
            }
        } else {
            callback('Invalid relay specified');
        }
    }
}

var relayDemo = function(params, callback) {
    console.log(relaypositions);
    setTimeout(function() {
        setRelayPosition({relay: params.relay, position: params.position}, function(err) {
            if(err) {
                callback(err);
            } else {
                callback(false);
            }
            let position;
            let relay;
            if(params.relay===8) {
                relay = 1;
                if(params.position===1) {
                    position = 0;
                } else {
                    position = 1;
                }
                getRelayPositions(function(err, data) {
                    if(err) {
                        callback(err);
                    } else {
                        //console.log(data);
                        callback(false);
                    }
                    relayDemo({relay: relay, position: position}, function(err) {
                        if(err) {
                            console.log(err)
                        }
                    });
                });
            } else {
                position = params.position;
                relay = params.relay + 1;
                relayDemo({relay: relay, position: position}, function(err) {
                    if(err) {
                        //console.log(err)
                    }
                });
            }
        });
    }, 100);
}

module.exports = {
    setRelayPosition: function(params, callback) {
        setRelayPosition(params, function(err) {
            if(err) {
                callback(err);
            } else {
                callback(false);
            }
        });
    },
    getRelayPositions: function(callback) {
        getRelayPositions(function(err, data) {
            if(err) {
                callback(err, false);
            } else {
                callback(false, data);
            }
        });
    },
    startRelayDemo: function() {
        relayDemo({relay: 1, position: 0}, function(err) {
            if(err) {
                console.log(err);
            }
        });
    }
}

relayDemo({relay: 1, position: 0}, function(err) {
    if(err) {
        console.log(err);
    }
});