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

    this.brightness = 0;

    if (!this.mqttBroker) {
        this.log.warn('Config is missing mqtt_broker, fallback to default.');        
        this.mqttBroker = default_broker_address;
        if (!this.mqttBroker.contains("mqtt://")) {
            this.mqttBroker = "mqtt://" + this.mqttBroker;
        }
    }

    if (!this.mqttChannel) {
        this.log.warn('Config is missing mqtt_channel, fallback to default.');
        this.mqttChannel = default_mqtt_channel;        
    }

    init_mqtt(this.mqttBroker, this.mqttChannel);
}

function init_mqtt(broker_address, channel) {
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

      if (topic == channel) {
        this.state = message;
        this.brightness = parseInt(message)
            
        this.getServices[0]
        .getCharacteristic(Characteristic.ContactSensorState)
        .setValue(this.state);

        console.log("[processing] " + mqtt_channel + " to " + message)
      }      
    })
  }

Dimmer.prototype.setBrightness = function(level, callback) {

    if(level > this.maxBrightness){
        //enforce maximum volume
        this.brightness = this.maxBrightness;
        this.log('Volume %s capped to max volume %s', level, this.maxBrightness);
    } else {
        this.brightness = level
    }

    this.log('Publishing level %s', String(newBrightness));

    if (mqttClient) {
        mqttClient.publish("/dimmer/brightness", String(newBrightness));
    } else {
        this.log('MQTT client not ready');
    }

    // null, brightness = no result
    this.log('callback()');
    callback(); // first would be error
}

Dimmer.prototype.getBrightness = function(callback) {
    // ESP has no getter, sends by 30 sec and by change
    this.log('getBrightness callback(null, '+this.brightness+')');
    callback(null, this.brightness);
    /*
    this.getBrightness(function(status) {
        var brightness = parseInt(status);
        callback(null, brightness);
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