if (not IsFrameworkStarted("ox")) then return end

local chunk = LoadResourceFile("ox_core", "lib/init.lua")
load(chunk, "@@ox_core/lib/init.lua", "t")()

if (not Ox) then
    error('\n > Unable to access ox_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@param src number
---@return table
local function getPlayer(src)
    return Ox.GetPlayer(src)
end

---@param src number
---@param job string
---@return boolean
local function hasJob(src, job)
    local player = getPlayer(src)

    return player.get('activeGroup') == job
end

---@param src number
---@param job string
---@param grade number
local function hasGrade(src, job, grade)
    local player = getPlayer(src)
    local groups = player.getGroups()

    if not groups[job] then return false end

    return groups[job] <= grade
end

local function getName(src)
    local player = getPlayer(src)

    if not player then return GetPlayerName(src) end

    local firstName, lastName = player.get('firstName'), player.get('lastName')

    return string.format("%s %s", firstName, lastName)
end

local function getEmployees(group)
    local players = Ox.GetPlayers({ activeGroup = group })
    local targets = {}

    for i = 1, #players do
        local player = players[i]
        local phone = exports['lb-phone']:GetEquippedPhoneNumber(player.source)

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

AddEventHandler('ox:playerLogout', function (playerId)
    clearcache(playerId)
end)

exports('hasJob', hasJob)
exports('hasGrade', hasGrade)
exports('getName', getName)
exports('getEmployees', getEmployees)
