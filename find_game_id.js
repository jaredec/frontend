// This is a standalone Node.js script to check for live MLB games.
// To run it, navigate to its directory in your terminal and use the command:
// node find_game_id.js

const https = require('https');

// The MLB Stats API endpoint for today's schedule
const url = 'https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1';

console.log('Fetching live game data from MLB Stats API...');

https.get(url, (res) => {
    let data = '';

    // A chunk of data has been received.
    res.on('data', (chunk) => {
        data += chunk;
    });

    // The whole response has been received.
    res.on('end', () => {
        try {
            const schedule = JSON.parse(data);
            const liveGames = [];

            if (schedule.dates && schedule.dates.length > 0) {
                const games = schedule.dates[0].games;
                games.forEach(game => {
                    const status = game.status.detailedState;
                    // Check for any "in-progress" style status
                    if (status === 'In Progress' || status === 'Live') {
                        liveGames.push({
                            gamePk: game.gamePk,
                            awayTeam: game.teams.away.team.name,
                            homeTeam: game.teams.home.team.name,
                            status: status
                        });
                    }
                });
            }

            if (liveGames.length > 0) {
                console.log('\n✅ Found Live Games! ✅\n');
                liveGames.forEach(game => {
                    console.log(`- ${game.awayTeam} @ ${game.homeTeam}`);
                    console.log(`  Game ID (gamePk): ${game.gamePk}\n`);
                });
            } else {
                console.log('❌ No live games are currently in progress according to the API.');
            }

        } catch (error) {
            console.error('Error parsing the API response:', error.message);
        }
    });

}).on('error', (err) => {
    console.error('Error fetching data from the API:', err.message);
});