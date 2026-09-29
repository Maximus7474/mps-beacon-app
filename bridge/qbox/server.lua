if (not IsFrameworkStarted("qbx")) then return end

local QBox = exports.qbx_core

if (not QBox) then
    error(
    '\n > Unable to access qbx_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@param src number
---@return table
local function getPlayer(src)
    return QBox:GetPlayer(src)
end

---@param src number
---@param job string
---@return boolean
local function hasJob(src, job)
    return QBox:HasGroup(src, job)
end

---@param src number
---@param job string
---@param grade number
local function hasGrade(src, job, grade)
    return QBox:HasGroup(src, { [job] = grade })
end

local function getName(src)
    local player = getPlayer(src)

    if not player then return GetPlayerName(src) end

    local firstName, lastName = player.PlayerData.charinfo.firstname, player.PlayerData.charinfo.lastname

    return string.format("%s %s", firstName, lastName)
end

local function getEmployees(group)
    local players = qbx:GetQBPlayers()
    local targets = {}

    for src, player in pairs(players) do
        if player.PlayerData.job.name == group then
            local phone = exports['lb-phone']:GetEquippedPhoneNumber(src)
            if phone then
                table.insert(targets, src)
            end
        end
    end

    return targets
end

---@param src number
local function clearcache(src)
    exports['mps-beacon-app']:clearcache(src)
end

AddEventHandler('QBCore:Server:OnPlayerUnload', function (playerId)
    clearcache(playerId)
end)

exports('hasJob', hasJob)
exports('hasGrade', hasGrade)
exports('getName', getName)
exports('getEmployees', getEmployees)

FrameworkLoaded = true
