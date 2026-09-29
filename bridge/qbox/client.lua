if (not IsFrameworkStarted("qbx")) then return end

local QBox = exports.qbx_core

if (not QBox) then
    error(
    '\n > Unable to access qbx_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

local playerData = {}

---@return nil | { group: string; grade: number; }
local function getJobData()
    local player = Ox.GetPlayer()
    if (not player) then return nil end

    if not playerData.job.onduty then return nil end

    return {
        group = playerData.job.name,
        grade = playerData.job.grade.level,
    }
end

local function init()
    playerData = QBox:GetPlayerData()
    if (not playerData) then return print('no PLAYER !') end

    TriggerEvent('beaconapp:client:ready')
    TriggerEvent('beaconapp:groupupdate', getJobData())
    print('qbx_core bridge is ready')
end

RegisterNetEvent("QBCore:Client:SetDuty", function(onDuty)
    playerData.job.onduty = onDuty

    TriggerEvent('beaconapp:groupupdate', getJobData())
end)

if LocalPlayer.state.isLoggedIn then
	init()
else
    while not LocalPlayer.state.isLoggedIn do
        Wait(500)
    end
    init()
end

exports('getJobData', getJobData)

FrameworkLoaded = true
