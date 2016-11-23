# homebridge-plugin-pwmdimmer

Have your ESP-based PWM Brightness controller as a HomeKit accessory on your iOS device.

## TL;DR

Example of bidirectional homebridge-mqtt gateway. Requires ESP8266 based device with NodeMCU firmware (controlling a MosFET LED driver bridge using PWM) that serves as MQTT client. You are responsible to provide MQTT broker (like Mosquitto). 

## Installation

Checkout/download/unzip/whatever:
    
    cd homebridge-plugin-pwmdimmer
    
    # Install this npm package globally
    npm install -g .
    
Upload files from esp8266/ folder to your ESP using ESPTool or any other tool you prefer.

    init.lua - bootloader with couple seconds to interrupt after power-on
    application.lua - app that gets executed after given power-on timeout

Add Homebridge accessory to ~/homebridge/config.json:
    
     "accessories" : [
        {
          "accessory" : "Dimmer",
          "name" : "LED Stripe",
          "description" : "ESP8266 MQTT PWM dimmer",
          "max_brightness" : 100,
          "mqtt_broker" : "mqtt://192.168.1.21",
          "mqtt_channel" : "/kitchen/dimmer"
        }
      ]

Start Homebridge.
