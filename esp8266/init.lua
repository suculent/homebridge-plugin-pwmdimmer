-- init.lua
local IDLE_AT_STARTUP_MS = 5000
print("Will bootstrap in 5 seconds...")
tmr.alarm(1,IDLE_AT_STARTUP_MS,0,function()
    dofile("application.lua") -- Security delay in case the app locks CPU
end)
