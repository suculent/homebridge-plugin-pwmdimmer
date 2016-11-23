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

    this.brightness = 0; // consider enabled by default, set -1 on failure.

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

    mqttClient.on('error', function () {
      console.log("MQTT connected, subscribing to: " + channel)
      mqttClient.subscribe(channel + "/dimmer")
      this.brightness = -1
    })

    mqttClient.on('offline', function () {
      console.log("MQTT connected, subscribing to: " + channel)
      mqttClient.subscribe(channel + "/dimmer")
      this.brightness = -1
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

// Keeps brightness
Dimmer.prototype.setPowerState = function(powerOn, callback, context) {
    this.log('setPowerState: %s', String(powerOn));
    if(context !== 'fromSetValue') {        
        if (mqttClient) {  
            if (powerOn) {
                mqttClient.publish("/dimmer/brightness", String(this.brightness));
            } else {
                mqttClient.publish("/dimmer/brightness", String(0));
            }              
            callback(null);
        }    
    }
}

Dimmer.prototype.getPowerState = function(callback) {
    this.log('getPowerState callback(null, '+this.brightness+')');
    var status = 0
    if (this.brightness > 0) {
        callback(null, 1);
    } else {
        callback(null, 0);
    }
}

Dimmer.prototype.setBrightness = function(level, callback) {
    this.log('setBrightness: %s', String(level));
    if(level > this.maxBrightness){
        //enforce maximum volume
        this.brightness = this.maxBrightness;
        this.log('Volume %s capped to max volume %s', level, this.maxBrightness);
    } else {
        this.brightness = level
    }
    this.log('setBrightness: %s', String(this.brightness));
    if (mqttClient) {
        mqttClient.publish("/dimmer/brightness", String(this.brightness));
    } else {
        this.log('MQTT client not ready');
    }
    this.log('callback(null)');
    callback(null);
}

Dimmer.prototype.getBrightness = function(callback) {
    // ESP has no getter, sends by 30 sec and by change
    this.log('getBrightness callback(null, '+this.brightness+')');
    callback(null, this.brightness);
    /* async would be:
    this.getBrightness(function(status) {
        var brightness = parseInt(status);
        callback(null, brightness);
    }.bind(this));
    */
}

Dimmer.prototype.getServices = function() {

    var lightbulbService = new Service.Lightbulb(this.name);
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Page 42")
      .setCharacteristic(Characteristic.Model, "LED Dimmer")
      .setCharacteristic(Characteristic.SerialNumber, "2");

    lightbulbService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));

    lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));        

    return [lightbulbService, informationService];
}