if (not IsFrameworkStarted("esx")) then return end

local ESX = exports["es_extended"]:getSharedObject()

if (not ESX) then
    error(
        '\n > Unable to access es_extended exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@param src number
---@return table
local function getPlayer(src)
    return ESX.GetPlayerFromId(src)
end

---@param src number
---@param job string
---@return boolean
local function hasJob(src, job)
    local player = getPlayer(src)

    return player.job.name == job
end

---@param src number
---@param job string
---@param grade number
local function hasGrade(src, job, grade)
    local player = getPlayer(src)

    return player.job.name == job and player.job.grade >= grade
end

local function getName(src)
    local player = getPlayer(src)

    if not player then return GetPlayerName(src) end

    return player.getName()
end

local function getEmployees(group)
    local players = ESX.GetExtendedPlayers('job', group)
    local targets = {}

    for i = 1, #players do
        local player = players[i]
        local phone = exports['lb-phone']:GetEquippedPhoneNumber(player.src)

        if phone then
            table.insert(targets, player.source)
        end
    end

    return targets
end

---@param src number
local function clearcache(src)
    exports['mps-beacon-app']:clearcache(src)
end

AddEventHandler('esx:playerLogout', function (playerId)
    clearcache(playerId)
end)

exports('hasJob', hasJob)
exports('hasGrade', hasGrade)
exports('getName', getName)
exports('getEmployees', getEmployees)

FrameworkLoaded = true
