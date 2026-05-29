fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author 'QBCore + Refactored'
description 'Premium Boss/Gang Management Dashboard'
version '3.0.0'

shared_scripts {
    '@qb-core/shared/locale.lua',
    'locales/en.lua',
    'locales/*.lua',
    'config.lua',
}

ui_page 'html/ui.html'

files {
    'html/ui.html',
    'html/style.css',
    'html/app.js'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}
