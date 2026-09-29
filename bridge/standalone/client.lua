Wait(1000)
if (not IsFrameworkStarted("standalone")) then return end

---@return nil | { group: string; grade: number; }
local function getJobData()
    -- local player = GetPlayer()
    -- if (not player) then return nil end

    -- if not onduty then return nil end

    return {
        group = "unemployed",
        grade = 0,
    }
end

local function init()
    -- local player = GetPlayer()
    -- if (not player) then return print('no PLAYER !') end

    TriggerEvent('beaconapp:client:ready')
    TriggerEvent('beaconapp:groupupdate', getJobData())
    print('standalone bridge is ready')
end

--- when the player's character loads
--- call init at top level if you can check if the player
--- has already loaded, useful in case of resource restarts
AddEventHandler('playerLoaded', init)

--- when the player's character's job changes (job or duty status)
RegisterNetEvent('jobchange', function()
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

exports('getJobData', getJobData)

FrameworkLoaded = true
