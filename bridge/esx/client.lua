if (not IsFrameworkStarted("esx")) then return end

local ESX = exports["es_extended"]:getSharedObject()

if (not ESX) then
    error(
    '\n > Unable to access es_extended exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@return nil | { group: string; grade: number; }
local function getJobData()
    local playerData = ESX.GetPlayerData()
    if (not player) then return nil end

    local jobData = player.job
    if not jobData or not jobData.onDuty == false then return nil end

    return {
        group = jobData.name,
        grade = jobData.grade,
    }
end

local function init()
    TriggerEvent('beaconapp:client:ready')
    TriggerEvent('beaconapp:groupupdate', getJobData())
    print('es_extended bridge is ready')
end

AddEventHandler('esx:playerLoaded', init)

RegisterNetEvent('esx:setJob', function()
    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

if ESX.PlayerLoaded then
	init()
end

exports('getJobData', getJobData)

FrameworkLoaded = true
