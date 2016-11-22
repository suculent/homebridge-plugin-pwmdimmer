/*
 * This HAP device connects to defined or default mqtt broker/channel and responds to brightness.
 */

// npm install request --save
var request = require('request');

var Service, Characteristic;

// should go from config
var default_broker_address = 'mqtt://localhost'
var default_mqtt_channel = "/dimmer"

var mqtt = require('mqtt')
var mqttClient = null; // will be non-null if working

var brightness = 0;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-dimmer", "Dimmer", Dimmer);
}

function Dimmer(log, config) {
    this.log = log;

    this.name = config['name'] || "Dimmer Brightness";
    this.maxBrightness = config['max_brightness'] || 100;
    this.mqttBroker = config['mqtt_broker'];
    this.mqttChannel = config['mqtt_channel'];

    if (!this.mqttBroker) {
        this.log.warn('Config is missing mqtt_broker, fallback to default.');
        this.mqttBroker = default_broker_address;
    }

    if (!this.mqttChannel) {
        this.log.warn('Config is missing mqtt_channel, fallback to default.');
        this.mqttChannel = default_mqtt_channel;        
    }

    init_mqtt(this.mqttBroker, this.mqttChannel);
}

Dimmer.prototype.init_mqtt(broker_address, channel) {   
    console.log("Connecting to mqtt broker: " + broker_address)
    mqttClient = mqtt.connect(broker_address)

    var that = this

    mqttClient.on('connect', function () {
      console.log("MQTT connected, subscribing to: " + channel)
      mqttClient.subscribe(channel + "/dimmer")
    })

    mqttClient.on('message', function (topic, message) {
      console.log("message: " + message.toString())

      var pin = 0

      if (topic == (mqtt_channel + "/dimmer")) {
        this.state = message;
        brightness = parseInt(message)
            
        this.getServices[0]
        .getCharacteristic(Characteristic.ContactSensorState)
        .setValue(this.state);

        console.log("[processing] " + mqtt_channel + " to " + message)
      }      
    })
  }

Dimmer.prototype.setBrightness = function(level, callback) {

    var newVolume = level;

    if(level > this.maxVolume){
        //enforce maximum volume
        newVolume = this.maxVolume;
        this.log('Volume %s capped to max volume %s on %s', level, this.maxVolume, this.zoneName);
    }

    mqttClient.publish("/dimmer/brightness", level)
}

Dimmer.prototype.getBrightness = function(callback) {
    // ESP has no getter, sends by 30 sec and by change
    callback(null, brightness);
    /*
    this.getStatus(function(status) {
        var volume = parseInt(status.MasterVolume[0].value[0]) + 80;
        callback(null, volume);
    }.bind(this));
    */
}

Dimmer.prototype.getServices = function() {
    var lightbulbService = new Service.Lightbulb(this.name);

    lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));

    return [lightbulbService];
}