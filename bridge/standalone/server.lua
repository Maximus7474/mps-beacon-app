Wait(1000)
if (not IsFrameworkStarted("standalone")) then return end

---@param src number
---@return table
local function getPlayer(src)
    return {}
end

---@param src number
---@param job string
---@return boolean
local function hasJob(src, job)
    local player = getPlayer(src)

    return false
end

---@param src number
---@param job string
---@param grade number
local function hasGrade(src, job, grade)
    local player = getPlayer(src)

    return false
end

local function getName(src)
    local player = getPlayer(src)

    return GetPlayerName(src)

    -- if not player then return GetPlayerName(src) end

    -- local firstName, lastName = player.get('firstName'), player.get('lastName')

    -- return string.format("%s %s", firstName, lastName)
end

local function getEmployees(group)
    local players = {} -- GetPlayers()
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

AddEventHandler('playerLogout', function (playerId)
    clearcache(playerId)
end)

exports('hasJob', hasJob)
exports('hasGrade', hasGrade)
exports('getName', getName)
exports('getEmployees', getEmployees)

FrameworkLoaded = true
