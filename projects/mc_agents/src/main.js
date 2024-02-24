// main.js located in ./

const mineflayer = require('mineflayer');
const { pathfinder, Movements } = require('mineflayer-pathfinder');
const { BOT_CONFIG, START_POINT } = require('./config.js');
const { skillFunctions } = require('./skills.js');
const { createGPTAssistant, deleteGPTAssistant, performGPTCommand } = require('./gpt.js');

const botRegistry = {};

function createBot(botConfig) {
    const bot = mineflayer.createBot(botConfig);

    bot.on('spawn', async () => {
        console.log(`@${bot.username} has spawned.`);

        // Create a GPT for this bot
        await createGPTAssistant(bot);

        // Pathfinder setup
        bot.loadPlugin(pathfinder);
        const defaultMove = new Movements(bot, require('minecraft-data')(bot.version));
        bot.pathfinder.setMovements(defaultMove);

        // Teleport to starting location
        console.log(`INFO: Teleporting to (x=${START_POINT.x}, y=${START_POINT.y}, z=${START_POINT.z})`);
        bot.chat(`/tp ${START_POINT.x} ${START_POINT.y} ${START_POINT.z}`);
    });

    bot.on('chat', async (username, message) => {
        console.log(`@${username}: ${message}`);
        
        // Redirect command to the correct bot
        if (!message.toLowerCase().startsWith(`@${bot.username.toLowerCase()}`)) {
            return;
        }
        const regex = new RegExp(`^@${bot.username}`, 'i');
        const command = message.replace(regex, '').trim();

        if (command.startsWith('/')) {

            if (bot.username === BOT_CONFIG["username"] && command.startsWith("/spawn")) {
                const [_, botName] = command.split(' ');
                if (botRegistry[botName]) {
                    console.log(`Bot ${botName} already exists.`);
                    return;
                }
                const newBotConfig = { ...BOT_CONFIG, username: botName };
                botRegistry[botName] = createBot(newBotConfig);
                return;
            }

            await performCommand(bot, command);
        } else {
            const response = await performGPTCommand(bot, command);
            bot.chat(response);
        }
    });

    return bot;
}

async function performCommand(bot, command) {
    if (command.startsWith('/gototree')) {

        await skillFunctions["goToClosestTree"](bot);

    } else if (command.startsWith('/harvesttree')) {

        await skillFunctions["harvestTree"](bot);

    } else if (command.startsWith('/create')) {

        if (!gptAssistant) {
            await createGPTAssistant(bot);
        }

    } else if (command.startsWith('/reset')) {

        if (bot.gptAssistant) {
            await deleteGPTAssistant(bot);
        }
        await createGPTAssistant(bot);

    } else if (command.startsWith('/delete')) {

        await deleteGPTAssistant(bot);

    } else {
        console.warn(`Unrecognized command: ${command}`);
    }
}

botRegistry[BOT_CONFIG["username"]] = createBot(BOT_CONFIG);

// Signal handling for cleanup
process.on('SIGINT', async () => {
    console.log('INFO: Deleting GPTs before exiting');

    // Collect all promises from the delete operation
    const deletePromises = Object.keys(botRegistry).map(botName => {
        return deleteGPTAssistant(botRegistry[botName]);
    });

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    console.log('INFO: Exiting');
    process.exit();
});