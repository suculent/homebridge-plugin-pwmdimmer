dofile("config.lua")  -- defines ssid, password and mqtt broker IP

pin = 4 -- !!! do not attach this pin 4 (gpio02) on reset, use another pin instead. anything is better than this. !!!
duty = 1 -- from interval 1..1023
maxDuty = 511 -- from interval 1..1023
repeats = 2 -- for testing
clock = 1000 -- from interval 1..1000

gpio.mode(pin, gpio.OUTPUT)
gpio.write(pin, gpio.HIGH)

-- initialize (turn off)
pwm.setup(pin, clock, duty)
pwm.start(pin)
pwm.stop(pin)

-- dimmer/fader state machine

-- -1 = fadeout; +1 = fadein
direction = 1 

-- using global duty as a real state machine, currentPercent is dependent
currentPercent = 0

m = 0 -- mqtt client global hint

-- networking

function connect(ssid, password)
    wifi.setmode(wifi.STATION)
    wifi.sta.config(ssid, password)
    wifi.sta.connect()
    tmr.alarm(1, 2000, 1, function()
        if wifi.sta.getip() == nil then
            print("Connecting " .. ssid .. "...")
        else
            tmr.stop(1)
            print("Connected to " .. ssid .. ", IP is "..wifi.sta.getip())
            mq(mqtt_broker) -- define in config.lua
        end
    end)
end

function mq(target)
    m = mqtt.Client(node.chipid(), 120, "username", "password")
    m:lwt("/lwt", "offline", 0, 0)
    m:on("connect", function(client) 
        print ("connected") 
    end)
    m:on("offline", function(client) 
        print ("offline") 
        m:close();        
        connect(wifi_ssid, wifi_password)
    end)

    m:on("message", function(client, topic, data) 
        if data ~= nil then fadeToPercent(data) end
    end)

    print("Connecting to MQTT to " .. target .. "...")
    m:connect(target, 1883, 0,
    function(client)
        print(":mconnected") 
        m:subscribe("/dimmer/brightness",0, function(client) print("subscribe success") end)
        local initial_state = tonumber(getBrightness())
        m:publish("/dimmer",initial_state,0,0)  
    end,     
    function(client, reason)
        print("failed reason: "..reason)
    end
)

end

-- ops

function getBrightness()
    local brightnessPercent = duty/maxDuty * 100
    return brightnessPercent
end

function fadeToPercent(percent)
    percent = tonumber(percent)
    local continue = true
    local targetDuty = maxDuty * percent / 100
    -- print("targetDuty " .. targetDuty)

    if percent == currentPercent then
        direction = 0
    else
        if percent > currentPercent then
            direction = 1
        else
            direction = -1
        end
    end

    while continue do
        tmr.delay(100)
        pwm.setup(pin, clock, duty)
        pwm.start(pin)    
        duty = duty + direction               
        -- print(duty) -- causes significant delay
        if duty == targetDuty then
            currentPercent = percent                      
            continue = false
        end        
    end
    
    if m == 0 then
        -- no publish channel
    else
        m:publish("/dimmer",currentPercent,0,0)
    end  
    collectgarbage()
end

-- main
connect(wifi_ssid, wifi_password)
