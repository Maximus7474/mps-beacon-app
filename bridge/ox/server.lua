if (not IsFrameworkStarted("ox")) then return end

local OX = exports["ox_core"]

if (not OX) then
    error('\n > Unable to access ox_core exported functions, please check why this is occuring.\n > This script WILL NOT work until you resolve this.')
    return
end

---@param src number
---@return table
local function getPlayer(src)
    return OX:GetPlayer(src)
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

exports('hasJob', hasJob)
exports('hasGrade', hasGrade)
