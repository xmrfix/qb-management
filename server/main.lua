local QBCore = exports['qb-core']:GetCoreObject()

MySQL.ready(function()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `management_funds` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `job_name` VARCHAR(50) NOT NULL,
            `amount` INT(11) NOT NULL DEFAULT 0,
            `type` VARCHAR(50) NOT NULL DEFAULT 'boss',
            PRIMARY KEY (`id`),
            UNIQUE KEY `job_name` (`job_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `management_transactions` (
            `id` INT(11) NOT NULL AUTO_INCREMENT,
            `job_name` VARCHAR(50) NOT NULL,
            `type` VARCHAR(50) NOT NULL,
            `amount` INT(11) NOT NULL,
            `source` VARCHAR(100) NOT NULL,
            `description` VARCHAR(255) DEFAULT '',
            `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
end)

local function GetAccount(job, type)
    local result = MySQL.query.await('SELECT amount FROM management_funds WHERE job_name = ? AND type = ?', {job, type})
    if result[1] ~= nil then
        return result[1].amount
    else
        MySQL.insert.await('INSERT INTO management_funds (job_name, amount, type) VALUES (?, ?, ?)', {job, 0, type})
        return 0
    end
end

local function AddMoney(job, amount, type)
    if amount <= 0 then return false end
    local balance = GetAccount(job, type)
    MySQL.update.await('UPDATE management_funds SET amount = ? WHERE job_name = ? AND type = ?', {balance + amount, job, type})
    return true
end

local function RemoveMoney(job, amount, type)
    if amount <= 0 then return false end
    local balance = GetAccount(job, type)
    if balance >= amount then
        MySQL.update.await('UPDATE management_funds SET amount = ? WHERE job_name = ? AND type = ?', {balance - amount, job, type})
        return true
    end
    return false
end

exports('GetAccount', GetAccount)
exports('AddMoney', AddMoney)
exports('RemoveMoney', RemoveMoney)
exports('GetBossAccount', function(job) return GetAccount(job, 'boss') end)
exports('AddBossMoney', function(job, amount) return AddMoney(job, amount, 'boss') end)
exports('RemoveBossMoney', function(job, amount) return RemoveMoney(job, amount, 'boss') end)
exports('GetGangAccount', function(gang) return GetAccount(gang, 'gang') end)
exports('AddGangMoney', function(gang, amount) return AddMoney(gang, amount, 'gang') end)
exports('RemoveGangMoney', function(gang, amount) return RemoveMoney(gang, amount, 'gang') end)

local function ExploitBan(id, reason)
    MySQL.insert('INSERT INTO bans (name, license, discord, ip, reason, expire, bannedby) VALUES (?, ?, ?, ?, ?, ?, ?)', {
        GetPlayerName(id),
        QBCore.Functions.GetIdentifier(id, 'license'),
        QBCore.Functions.GetIdentifier(id, 'discord'),
        QBCore.Functions.GetIdentifier(id, 'ip'),
        reason,
        2147483647,
        'qb-management'
    })
    DropPlayer(id, 'You were permanently banned by the server for: Exploiting')
end

local function GetEmployees(job, type)
    local employees = {}
    local query = "SELECT * FROM `players` WHERE `job` LIKE '%" .. job .. "%'"
    if type == 'gang' then
        query = "SELECT * FROM `players` WHERE `gang` LIKE '%" .. job .. "%'"
    end
    
    local players = MySQL.query.await(query, {})
    if players[1] ~= nil then
        for _, value in pairs(players) do
            local Target = QBCore.Functions.GetPlayerByCitizenId(value.citizenid) or QBCore.Functions.GetOfflinePlayerByCitizenId(value.citizenid)
            if Target then
                local tJob = type == 'gang' and Target.PlayerData.gang or Target.PlayerData.job
                if tJob.name == job then
                    employees[#employees+1] = {
                        cid = Target.PlayerData.citizenid,
                        name = Target.PlayerData.charinfo.firstname .. ' ' .. Target.PlayerData.charinfo.lastname,
                        grade = tJob.grade,
                        isOnline = Target.PlayerData.source ~= nil
                    }
                end
            end
        end
    end
    table.sort(employees, function(a, b) return a.grade.level > b.grade.level end)
    return employees
end

QBCore.Functions.CreateCallback('qb-management:server:GetDashboardData', function(source, cb, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then
        ExploitBan(src, 'GetDashboardData Exploiting')
        return cb(nil)
    end

    local balance = GetAccount(groupName, groupType)
    local employees = GetEmployees(groupName, groupType)
    
    -- Fetch real transactions from database
    local transactions = MySQL.query.await('SELECT * FROM management_transactions WHERE job_name = ? ORDER BY date DESC LIMIT 50', {groupName})

    cb({
        balance = balance,
        employees = employees,
        transactions = transactions or {}
    })
end)

QBCore.Functions.CreateCallback('qb-management:server:DepositFunds', function(source, cb, amount, reason, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if amount <= 0 then return cb(false) end

    if Player.Functions.RemoveMoney('cash', amount, "boss-deposit") then
        AddMoney(groupName, amount, groupType)
        local sourceName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname
        MySQL.insert('INSERT INTO management_transactions (job_name, type, amount, source, description) VALUES (?, ?, ?, ?, ?)', {
            groupName, 'deposit', amount, sourceName, reason or 'Deposit'
        })
        cb(true)
    else
        TriggerClientEvent('QBCore:Notify', src, 'Not enough cash!', 'error')
        cb(false)
    end
end)

QBCore.Functions.CreateCallback('qb-management:server:WithdrawFunds', function(source, cb, amount, reason, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if amount <= 0 then return cb(false) end

    if RemoveMoney(groupName, amount, groupType) then
        Player.Functions.AddMoney('cash', amount, "boss-withdraw")
        local sourceName = Player.PlayerData.charinfo.firstname .. ' ' .. Player.PlayerData.charinfo.lastname
        MySQL.insert('INSERT INTO management_transactions (job_name, type, amount, source, description) VALUES (?, ?, ?, ?, ?)', {
            groupName, 'withdraw', amount, sourceName, reason or 'Withdrawal'
        })
        cb(true)
    else
        TriggerClientEvent('QBCore:Notify', src, 'Not enough funds in society account!', 'error')
        cb(false)
    end
end)

QBCore.Functions.CreateCallback('qb-management:server:HireEmployee', function(source, cb, targetId, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local Target = exports['qb-core']:GetPlayer(targetId)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if not Target then return cb(false) end

    if groupType == 'gang' then
        Target.Functions.SetGang(groupName, 0)
    else
        Target.Functions.SetJob(groupName, 0)
    end
    TriggerClientEvent('QBCore:Notify', src, 'Successfully hired ' .. Target.PlayerData.charinfo.firstname, 'success')
    TriggerClientEvent('QBCore:Notify', targetId, 'You were hired into ' .. pGroup.label, 'success')
    cb(true)
end)

QBCore.Functions.CreateCallback('qb-management:server:FireEmployee', function(source, cb, cid, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local Target = QBCore.Functions.GetPlayerByCitizenId(cid) or QBCore.Functions.GetOfflinePlayerByCitizenId(cid)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if not Target then return cb(false) end
    if Target.PlayerData.citizenid == Player.PlayerData.citizenid then
        TriggerClientEvent('QBCore:Notify', src, 'You cannot fire yourself!', 'error')
        return cb(false)
    end

    local tGroup = groupType == 'gang' and Target.PlayerData.gang or Target.PlayerData.job
    if tGroup.grade.level >= pGroup.grade.level then
        TriggerClientEvent('QBCore:Notify', src, 'You cannot fire someone of equal or higher rank!', 'error')
        return cb(false)
    end

    if groupType == 'gang' then
        Target.Functions.SetGang('none', 0)
    else
        Target.Functions.SetJob('unemployed', 0)
    end
    Target.Functions.Save()
    TriggerClientEvent('QBCore:Notify', src, 'Successfully fired employee.', 'success')
    if Target.PlayerData.source then
        TriggerClientEvent('QBCore:Notify', Target.PlayerData.source, 'You have been fired from ' .. pGroup.label, 'error')
    end
    cb(true)
end)

QBCore.Functions.CreateCallback('qb-management:server:PromoteEmployee', function(source, cb, cid, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local Target = QBCore.Functions.GetPlayerByCitizenId(cid) or QBCore.Functions.GetOfflinePlayerByCitizenId(cid)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if not Target then return cb(false) end

    local tGroup = groupType == 'gang' and Target.PlayerData.gang or Target.PlayerData.job
    if tGroup.grade.level >= pGroup.grade.level - 1 then
        TriggerClientEvent('QBCore:Notify', src, 'You cannot promote this person any higher!', 'error')
        return cb(false)
    end

    local newLevel = tGroup.grade.level + 1
    if groupType == 'gang' then
        Target.Functions.SetGang(groupName, newLevel)
    else
        Target.Functions.SetJob(groupName, newLevel)
    end
    Target.Functions.Save()
    TriggerClientEvent('QBCore:Notify', src, 'Successfully promoted employee.', 'success')
    if Target.PlayerData.source then
        TriggerClientEvent('QBCore:Notify', Target.PlayerData.source, 'You have been promoted!', 'success')
    end
    cb(true)
end)

QBCore.Functions.CreateCallback('qb-management:server:DemoteEmployee', function(source, cb, cid, groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    local Target = QBCore.Functions.GetPlayerByCitizenId(cid) or QBCore.Functions.GetOfflinePlayerByCitizenId(cid)
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job

    if pGroup.name ~= groupName or not pGroup.isboss then return cb(false) end
    if not Target then return cb(false) end

    local tGroup = groupType == 'gang' and Target.PlayerData.gang or Target.PlayerData.job
    if tGroup.grade.level >= pGroup.grade.level then
        TriggerClientEvent('QBCore:Notify', src, 'You cannot demote someone of equal or higher rank!', 'error')
        return cb(false)
    end
    if tGroup.grade.level <= 0 then
        TriggerClientEvent('QBCore:Notify', src, 'You cannot demote this person any lower! Use Fire instead.', 'error')
        return cb(false)
    end

    local newLevel = tGroup.grade.level - 1
    if groupType == 'gang' then
        Target.Functions.SetGang(groupName, newLevel)
    else
        Target.Functions.SetJob(groupName, newLevel)
    end
    Target.Functions.Save()
    TriggerClientEvent('QBCore:Notify', src, 'Successfully demoted employee.', 'success')
    if Target.PlayerData.source then
        TriggerClientEvent('QBCore:Notify', Target.PlayerData.source, 'You have been demoted.', 'error')
    end
    cb(true)
end)

QBCore.Functions.CreateCallback('qb-management:server:GetNearbyPlayers', function(source, cb)
    local src = source
    local players = {}
    local pPed = GetPlayerPed(src)
    local pCoords = GetEntityCoords(pPed)

    for _, v in pairs(QBCore.Functions.GetPlayers()) do
        local targetPed = GetPlayerPed(v)
        local dist = #(pCoords - GetEntityCoords(targetPed))
        if src ~= v and dist < 10.0 then
            local Target = exports['qb-core']:GetPlayer(v)
            players[#players+1] = {
                id = v,
                name = Target.PlayerData.charinfo.firstname .. ' ' .. Target.PlayerData.charinfo.lastname
            }
        end
    end
    cb(players)
end)

RegisterNetEvent('qb-management:server:openStash', function(groupName, groupType)
    local src = source
    local Player = exports['qb-core']:GetPlayer(src)
    
    -- Debugging Start
    print('^3[qb-management] Boss Stash Request:^7')
    print('  - Source:', src)
    print('  - Requested Group:', groupName)
    print('  - Requested Type:', groupType)
    
    if not Player then 
        print('  ^1- ERROR: Player not found.^7')
        return 
    end
    
    local pGroup = groupType == 'gang' and Player.PlayerData.gang or Player.PlayerData.job
    
    print('  - Player Job/Gang:', pGroup.name)
    print('  - Boss Status:', pGroup.isboss)
    
    if pGroup.name ~= groupName or not pGroup.isboss then 
        print('  ^1- ERROR: Permission Denied. Not the boss of ' .. tostring(groupName) .. '^7')
        TriggerClientEvent('QBCore:Notify', src, "Security: You are not the boss of " .. tostring(groupName), "error")
        return 
    end

    local stashName = (groupType == 'gang' and 'gang_' or 'boss_') .. groupName
    print('  - Resolved Stash Name:', stashName)
    
    local qbInvState = GetResourceState('qb-inventory')
    local oxInvState = GetResourceState('ox_inventory')
    local psInvState = GetResourceState('ps-inventory')
    
    print('  - qb-inventory:', qbInvState)
    print('  - ox_inventory:', oxInvState)
    print('  - ps-inventory:', psInvState)
    
    if oxInvState == 'started' then
        -- ox_inventory integration
        print('  - Action: Routing to ox_inventory')
        exports.ox_inventory:RegisterStash(stashName, pGroup.label .. " Stash", 50, 4000000)
        TriggerClientEvent("ox_inventory:openInventory", src, "stash", stashName)
        
    elseif qbInvState == 'started' or psInvState == 'started' then
        -- Native qb-inventory / ps-inventory server export
        print('  - Action: Routing to qb-inventory/ps-inventory Server Export')
        local invResource = qbInvState == 'started' and 'qb-inventory' or 'ps-inventory'
        exports[invResource]:OpenInventory(src, stashName, {
            maxweight = 4000000,
            slots = 50,
        })
    else
        -- Fallback Legacy Mode (Relies on client-side events)
        print('  - Action: Routing to Legacy Fallback')
        TriggerClientEvent("inventory:client:SetCurrentStash", src, stashName)
        TriggerClientEvent("inventory:client:OpenInventory", src, "stash", stashName)
    end
end)
