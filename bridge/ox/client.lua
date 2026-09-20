if (not IsFrameworkStarted("ox")) then return end

local OX = exports["ox_core"]

if (not OX) then
    error('\n > Unable to access ox_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

local player = OX:GetPlayer()

---@return nil | { group: string; grade: number; }
local function getJobData()
    local group = player.get('activeGroup')

    if not group then return nil end

    local grade = player.getGroup(group)

    return {
        group = group,
        grade = grade
    }
end

player.on('activeGroup', function ()
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

AddEventHandler('ox:playerLoaded', function ()
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

RegisterNetEvent('ox:setGroup', function(groupName, grade)
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

exports('getJobData', getJobData)
