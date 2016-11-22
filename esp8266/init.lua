--

pin = 4 -- gpio02! do not attach on reset.
duty = 1 -- 1..1023
maxDuty = 512
repeats = 2
clock = 1000 -- 1..1000

gpio.mode(pin, gpio.OUTPUT)
gpio.write(pin, gpio.HIGH)

-- initialize (turn off)
pwm.setup(pin, clock, duty)
pwm.start(pin)

-- -1 = fadeout; +1 = fadein
direction = 1 

pwm.stop(pin)

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
        print(topic .. ":" ) 
        if data ~= nil then print("message: " .. data) 
        print("Recieved:" .. topic .. ":" .. data)
            if data then
                print("Invoking fadeToPercent " .. data)
                fadeToPercent(data)
            else
            -- todo: reply with getBrightness
                print("Invalid command (no data)")
            end
        end
    end)

    print("Connecting to MQTT to " .. target .. "...")
    m:connect(target, 1883, 0,
    function(client)
        print(":mconnected") 
        m:subscribe("/dimmer/brightness",0, function(client) print("subscribe success") end)
        local initial_state = tonumber(getBrightness())
        m:publish("/dimmer",initial_state,0,0)
        local counter = 0
        local last_state = intial_state
        -- reporting every 30 secs
        tmr.alarm(1, 30000, 1, function()
            local current = tonumber(getBrightness())            
            m:publish("/dimmer",current,0,0)                
            current_state = current
            collectgarbage()
        end)        
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
    print("targetDuty " .. targetDuty)


    if percent == currentPercent then -- no-change condition
        --print("exit loop, value of percent equal")
       -- continue = false
    else

    -- decide direction
    if percent >= currentPercent then
        direction = 1
        print("direction++")
    else
        direction = -1
        print("direction--")
    end

    end -- end no-change condition

    while continue do
        tmr.delay(1)
        pwm.setup(pin, clock, duty)
        pwm.start(pin)    
        duty = duty + direction      
        print(duty) -- does not block pwm          
        if duty == targetDuty then
            print("exit loop, value of duty equal")
            if m == 0 then
                -- no publish channel
            else
                m:publish("/dimmer",currentPercent,0,0)
            end
            currentPercent = percent
            continue = false
        end
    end

end

-- test

fadeToPercent(100)

print("getBrightness: " .. getBrightness())

fadeToPercent(0)

print("getBrightness: " .. getBrightness())

-- main

dofile("config.lua")  -- defines ssid, password and mqtt broker IP

connect(wifi_ssid, wifi_password)
