if (not IsFrameworkStarted("ox")) then return end

local chunk = LoadResourceFile("ox_core", "lib/init.lua")
load(chunk, "@@ox_core/lib/init.lua", "t")()

if (not Ox) then
    error(
    '\n > Unable to access ox_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@return nil | { group: string; grade: number; }
local function getJobData()
    local player = Ox.GetPlayer()
    if (not player) then return nil end

    local group = player.get('activeGroup')
    if not group then return nil end

    return {
        group = group,
        grade = player.getGroup(group)
    }
end

local function init()
    local player = Ox.GetPlayer()
    if (not player) then return print('no PLAYER !') end

    player.on('activeGroup', function()
        TriggerEvent('beaconapp:groupupdate', getJobData())
    end)

    TriggerEvent('beaconapp:client:ready')
    TriggerEvent('beaconapp:groupupdate', getJobData())
    print('ox_core bridge is ready')
end

AddEventHandler('ox:playerLoaded', init)

RegisterNetEvent('ox:setGroup', function()
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

if Ox.GetPlayer()?.charId then
	init()
end

exports('getJobData', getJobData)

FrameworkLoaded = true
