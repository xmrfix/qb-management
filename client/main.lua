local QBCore = exports['qb-core']:GetCoreObject()
local currentGroup = nil
local currentGroupType = nil -- 'job' or 'gang'

local function OpenDashboard(groupName, groupType)
    currentGroup = groupName
    currentGroupType = groupType

    QBCore.Functions.TriggerCallback('qb-management:server:GetDashboardData', function(data)
        if not data then return end
        
        local Player = QBCore.Functions.GetPlayerData()
        local pGroup = groupType == 'gang' and Player.gang or Player.job

        local uiData = {
            job = {
                name = pGroup.name,
                label = pGroup.label,
                bossName = Player.charinfo.firstname .. ' ' .. Player.charinfo.lastname,
                balance = data.balance
            },
            employees = data.employees,
            transactions = data.transactions,
            nearbyPlayers = {}
        }

        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'open',
            data = uiData
        })
    end, groupName, groupType)
end

RegisterNetEvent('qb-bossmenu:client:OpenMenu', function()
    local Player = QBCore.Functions.GetPlayerData()
    if Player.job.isboss then
        OpenDashboard(Player.job.name, 'job')
    else
        QBCore.Functions.Notify('You are not a boss!', 'error')
    end
end)

RegisterNetEvent('qb-gangmenu:client:OpenMenu', function()
    local Player = QBCore.Functions.GetPlayerData()
    if Player.gang.isboss then
        OpenDashboard(Player.gang.name, 'gang')
    else
        QBCore.Functions.Notify('You are not a boss!', 'error')
    end
end)

-- Old commands fallback
RegisterCommand('bossmenu', function()
    TriggerEvent('qb-bossmenu:client:OpenMenu')
end, false)

RegisterCommand('gangmenu', function()
    TriggerEvent('qb-gangmenu:client:OpenMenu')
end, false)

-- NUI Callbacks
RegisterNUICallback('closeUI', function(data, cb)
    SetNuiFocus(false, false)
    currentGroup = nil
    currentGroupType = nil
    cb({ success = true })
end)

RegisterNUICallback('depositFunds', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:DepositFunds', function(success)
        cb({ success = success })
    end, data.amount, data.reason, currentGroup, currentGroupType)
end)

RegisterNUICallback('withdrawFunds', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:WithdrawFunds', function(success)
        cb({ success = success })
    end, data.amount, data.reason, currentGroup, currentGroupType)
end)

RegisterNUICallback('hireEmployee', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:HireEmployee', function(success)
        cb({ success = success })
    end, data.id, currentGroup, currentGroupType)
end)

RegisterNUICallback('invitePlayer', function(data, cb)
    -- App.js sends invitePlayer, map it to hireEmployee
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:HireEmployee', function(success)
        cb({ success = success })
    end, data.id, currentGroup, currentGroupType)
end)

RegisterNUICallback('fireEmployee', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:FireEmployee', function(success)
        cb({ success = success })
    end, data.cid, currentGroup, currentGroupType)
end)

RegisterNUICallback('promoteEmployee', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:PromoteEmployee', function(success)
        cb({ success = success })
    end, data.cid, currentGroup, currentGroupType)
end)

RegisterNUICallback('demoteEmployee', function(data, cb)
    if not currentGroup then return cb({ success = false }) end
    QBCore.Functions.TriggerCallback('qb-management:server:DemoteEmployee', function(success)
        cb({ success = success })
    end, data.cid, currentGroup, currentGroupType)
end)

RegisterNUICallback('getNearbyPlayers', function(data, cb)
    QBCore.Functions.TriggerCallback('qb-management:server:GetNearbyPlayers', function(players)
        cb({ players = players })
    end)
end)

RegisterNUICallback('openStash', function(data, cb)
    if currentGroup then
        local gName = currentGroup
        local gType = currentGroupType
        SetNuiFocus(false, false)
        currentGroup = nil
        currentGroupType = nil
        CreateThread(function()
            Wait(150)
            TriggerServerEvent('qb-management:server:openStash', gName, gType)
        end)
    end
    cb({ success = true })
end)

-- Markers and Targets
CreateThread(function()
    if Config.UseTarget then
        -- Boss Menus
        for k, v in pairs(Config.BossMenus) do
            for i = 1, #v do
                exports['qb-target']:AddBoxZone("bossmenu_"..k.."_"..i, v[i], 1.5, 1.5, {
                    name="bossmenu_"..k.."_"..i,
                    heading=0,
                    debugPoly=false,
                    minZ=v[i].z - 1,
                    maxZ=v[i].z + 1,
                }, {
                    options = {
                        {
                            type = "client",
                            event = "qb-bossmenu:client:OpenMenu",
                            icon = "fas fa-sign-in-alt",
                            label = "Open Boss Menu",
                            job = k,
                            canInteract = function()
                                local Player = QBCore.Functions.GetPlayerData()
                                return Player.job.name == k and Player.job.isboss
                            end,
                        },
                    },
                    distance = 2.0
                })
            end
        end

        -- Gang Menus
        for k, v in pairs(Config.GangMenus) do
            for i = 1, #v do
                exports['qb-target']:AddBoxZone("gangmenu_"..k.."_"..i, v[i], 1.5, 1.5, {
                    name="gangmenu_"..k.."_"..i,
                    heading=0,
                    debugPoly=false,
                    minZ=v[i].z - 1,
                    maxZ=v[i].z + 1,
                }, {
                    options = {
                        {
                            type = "client",
                            event = "qb-gangmenu:client:OpenMenu",
                            icon = "fas fa-sign-in-alt",
                            label = "Open Gang Menu",
                            gang = k,
                            canInteract = function()
                                local Player = QBCore.Functions.GetPlayerData()
                                return Player.gang.name == k and Player.gang.isboss
                            end,
                        },
                    },
                    distance = 2.0
                })
            end
        end
    else
        -- Markers / qb-core TextDraw
        local inZone = false
        CreateThread(function()
            while true do
                local sleep = 1000
                local pos = GetEntityCoords(PlayerPedId())
                local Player = QBCore.Functions.GetPlayerData()
                local isNear = false

                if Player.job.isboss and Config.BossMenus[Player.job.name] then
                    for _, coords in pairs(Config.BossMenus[Player.job.name]) do
                        if #(pos - coords) < 5.0 then
                            sleep = 0
                            if #(pos - coords) < 1.5 then
                                isNear = true
                                if not inZone then
                                    exports['qb-core']:DrawText('[E] Boss Menu', 'left')
                                    inZone = true
                                end
                                if IsControlJustReleased(0, 38) then
                                    TriggerEvent('qb-bossmenu:client:OpenMenu')
                                end
                            end
                        end
                    end
                end

                if not isNear and Player.gang.isboss and Config.GangMenus[Player.gang.name] then
                    for _, coords in pairs(Config.GangMenus[Player.gang.name]) do
                        if #(pos - coords) < 5.0 then
                            sleep = 0
                            if #(pos - coords) < 1.5 then
                                isNear = true
                                if not inZone then
                                    exports['qb-core']:DrawText('[E] Gang Menu', 'left')
                                    inZone = true
                                end
                                if IsControlJustReleased(0, 38) then
                                    TriggerEvent('qb-gangmenu:client:OpenMenu')
                                end
                            end
                        end
                    end
                end

                if not isNear and inZone then
                    exports['qb-core']:HideText()
                    inZone = false
                end

                Wait(sleep)
            end
        end)
    end
end)
