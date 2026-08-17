-- If using a custom framework other then the current supported ones,
-- Set it here, once the bridge folder has been created
local frameworkOveride = false --[[ @as false|string ]]

---Check if the framework is on the server
---@param framework "ox"|"esx"|"qb"|"qbx"|"standalone"
---@return boolean isStarted
function IsFrameworkStarted(framework)

    if (framework == frameworkOveride) then
        return true
    end

    if (framework == "ox") then
        local state = GetResourceState('ox_core')
        return state == "starting" or state == "started"
    elseif (framework == "esx") then
        local state = GetResourceState('es_extended')
        return state == "starting" or state == "started"
    elseif (framework == "qbx") then
        local state = GetResourceState('qbx-core')
        return state == "starting" or state == "started"
    elseif (framework == "standalone") then
        return true
    end

    warn(("An invalid framework was passed to \"IsFrameworkStarted\": %s"):format(framework))

    return false
end
