// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let lives = 3;
let gameSpeed = 1;
let shootCooldown = 0;
let shootFromLeft = true; // Alternating between left and right wing
let playerAnimationTime = 0; // Animation time for player ship effects
let torpedoCooldown = 0;
const SHOOT_INTERVAL = 3; // Frames between shots (lower = faster shooting)
const TORPEDO_COOLDOWN = 60; // Frames between torpedo shots (1 second at 60fps)
const TORPEDO_EXPLODE_TIME = 60; // Frames until torpedo explodes (1 second)
const TORPEDO_EXPLOSION_RADIUS = 100; // Damage radius

// Player object
const player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    width: 40,
    height: 50,
    vx: 0, // velocity x
    vy: 0, // velocity y
    acceleration: 0.8, // Increased for more responsive initial acceleration
    maxSpeed: 5,
    friction: 0.92, // deceleration (0.92 = 8% friction per frame)
    color: '#4a90e2'
};

// Arrays for game objects
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let torpedoes = [];
let explosions = []; // For torpedo explosions
let engineTrails = []; // For player ship engine trails
let nebulaClouds = []; // Background nebula effects

// Input handling
const keys = {};

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' && gameState === 'playing' && torpedoCooldown <= 0) {
        e.preventDefault();
        shootTorpedo();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Initialize stars for background
function initStars() {
    stars = [];
    for (let i = 0; i < 150; i++) {
        const starTypes = ['white', 'blue', 'yellow', 'orange'];
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2.5 + 0.5,
            speed: Math.random() * 2 + 1,
            color: starTypes[Math.floor(Math.random() * starTypes.length)],
            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.1 + 0.05
        });
    }
    
    // Initialize nebula clouds
    nebulaClouds = [];
    for (let i = 0; i < 3; i++) {
        nebulaClouds.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 200 + 150,
            opacity: Math.random() * 0.1 + 0.05,
            color: ['#1a1a3e', '#2a1a4e', '#1a2a4e'][Math.floor(Math.random() * 3)]
        });
    }
}

// Create bullet
function shootBullet(x, y) {
    bullets.push({
        x: x,
        y: y,
        width: 5,
        height: 25, // Longer bullets
        speed: 8,
        color: '#ffff00',
        time: 0 // Animation time for pulsing effect
    });
}

// Create torpedo
function shootTorpedo() {
    torpedoes.push({
        x: player.x,
        y: player.y - player.height / 2,
        width: 12,
        height: 20,
        vx: 0, // Horizontal velocity
        vy: -6, // Initial upward velocity
        acceleration: 0.3, // Acceleration towards target
        maxSpeed: 8, // Maximum speed
        time: 0,
        color: '#00ff00',
        exploded: false,
        trail: [] // Trail positions for visual effect
    });
    torpedoCooldown = TORPEDO_COOLDOWN;
}

// Create enemy
function createEnemy() {
    const baseSpeed = Math.random() * 2 + 2;
    const horizontalSpeed = (Math.random() - 0.5) * 3; // Random horizontal speed (-1.5 to 1.5)
    enemies.push({
        x: Math.random() * (canvas.width - 40),
        y: -40,
        width: 40,
        height: 40,
        vx: horizontalSpeed, // Horizontal velocity
        vy: baseSpeed, // Vertical velocity
        color: '#ff4444'
    });
}

// Create particle effect
function createParticles(x, y, color) {
    const explosionColors = ['#ff4444', '#ff8844', '#ffaa44', '#ffff44', '#ffaa88'];
    const particleCount = 25;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
        const speed = Math.random() * 6 + 2;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 40 + Math.random() * 20,
            maxLife: 40 + Math.random() * 20,
            size: Math.random() * 4 + 2,
            color: explosionColors[Math.floor(Math.random() * explosionColors.length)]
        });
    }
}

// Update player
function updatePlayer() {
    // Apply acceleration based on input
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        player.vx -= player.acceleration;
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        player.vx += player.acceleration;
    }
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        player.vy -= player.acceleration;
    }
    if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        player.vy += player.acceleration;
    }

    // Apply friction (deceleration)
    player.vx *= player.friction;
    player.vy *= player.friction;

    // Limit max speed
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > player.maxSpeed) {
        player.vx = (player.vx / speed) * player.maxSpeed;
        player.vy = (player.vy / speed) * player.maxSpeed;
    }

    // Update position based on velocity
    player.x += player.vx;
    player.y += player.vy;

    // Keep player in bounds (stop velocity if hitting boundary)
    if (player.x - player.width / 2 < 0) {
        player.x = player.width / 2;
        player.vx = 0;
    }
    if (player.x + player.width / 2 > canvas.width) {
        player.x = canvas.width - player.width / 2;
        player.vx = 0;
    }
    if (player.y - player.height / 2 < 0) {
        player.y = player.height / 2;
        player.vy = 0;
    }
    if (player.y + player.height / 2 > canvas.height) {
        player.y = canvas.height - player.height / 2;
        player.vy = 0;
    }
}

// Auto-shoot function
function updateAutoShoot() {
    if (shootCooldown <= 0) {
        // Calculate wing positions (guns on left and right wings)
        const wingOffset = player.width * 0.35; // Position guns on the wings
        const gunY = player.y - player.height * 0.2; // Slightly above center
        
        if (shootFromLeft) {
            // Shoot from left wing
            shootBullet(player.x - wingOffset, gunY);
        } else {
            // Shoot from right wing
            shootBullet(player.x + wingOffset, gunY);
        }
        
        // Alternate sides
        shootFromLeft = !shootFromLeft;
        shootCooldown = SHOOT_INTERVAL;
    } else {
        shootCooldown--;
    }
}

// Update bullets
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= bullets[i].speed;
        bullets[i].time += 0.2; // Increment animation time for pulsing
        
        // Remove bullets that are off screen
        if (bullets[i].y < 0) {
            bullets.splice(i, 1);
        }
    }
}

// Update torpedoes
function updateTorpedoes() {
    // Update torpedo cooldown
    if (torpedoCooldown > 0) {
        torpedoCooldown--;
    }
    
    for (let i = torpedoes.length - 1; i >= 0; i--) {
        const torpedo = torpedoes[i];
        
        if (!torpedo.exploded) {
            // Find nearest enemy
            let nearestEnemy = null;
            let nearestDistance = Infinity;
            
            for (let enemy of enemies) {
                const enemyCenterX = enemy.x + enemy.width / 2;
                const enemyCenterY = enemy.y + enemy.height / 2;
                const distance = Math.sqrt(
                    Math.pow(torpedo.x - enemyCenterX, 2) + 
                    Math.pow(torpedo.y - enemyCenterY, 2)
                );
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            }
            
            // If there's a nearest enemy, accelerate towards it
            if (nearestEnemy) {
                const enemyCenterX = nearestEnemy.x + nearestEnemy.width / 2;
                const enemyCenterY = nearestEnemy.y + nearestEnemy.height / 2;
                
                // Calculate direction vector
                const dx = enemyCenterX - torpedo.x;
                const dy = enemyCenterY - torpedo.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    // Normalize direction and apply acceleration
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    torpedo.vx += dirX * torpedo.acceleration;
                    torpedo.vy += dirY * torpedo.acceleration;
                    
                    // Limit max speed
                    const speed = Math.sqrt(torpedo.vx * torpedo.vx + torpedo.vy * torpedo.vy);
                    if (speed > torpedo.maxSpeed) {
                        torpedo.vx = (torpedo.vx / speed) * torpedo.maxSpeed;
                        torpedo.vy = (torpedo.vy / speed) * torpedo.maxSpeed;
                    }
                }
            }
            
            // Update position based on velocity
            torpedo.x += torpedo.vx;
            torpedo.y += torpedo.vy;
            torpedo.time++;
            
            // Add to trail
            torpedo.trail.push({ x: torpedo.x, y: torpedo.y });
            if (torpedo.trail.length > 8) {
                torpedo.trail.shift();
            }
            
            // Check if torpedo should explode (after 1 second or near top of screen)
            if (torpedo.time >= TORPEDO_EXPLODE_TIME || torpedo.y < 100) {
                torpedo.exploded = true;
                // Create explosion
                explosions.push({
                    x: torpedo.x,
                    y: torpedo.y,
                    radius: 0,
                    maxRadius: TORPEDO_EXPLOSION_RADIUS,
                    time: 0,
                    maxTime: 20
                });
                
                // Damage enemies in radius
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    const enemyCenterX = enemy.x + enemy.width / 2;
                    const enemyCenterY = enemy.y + enemy.height / 2;
                    const distance = Math.sqrt(
                        Math.pow(torpedo.x - enemyCenterX, 2) + 
                        Math.pow(torpedo.y - enemyCenterY, 2)
                    );
                    
                    if (distance < TORPEDO_EXPLOSION_RADIUS) {
                        // Enemy is in explosion radius - destroy it
                        createParticles(enemyCenterX, enemyCenterY, enemy.color);
                        enemies.splice(j, 1);
                        score += 10;
                        updateScore();
                    }
                }
            }
        }
        
        // Remove torpedoes that are off screen or exploded
        if (torpedo.y < -50 || (torpedo.exploded && torpedo.time > TORPEDO_EXPLODE_TIME + 5)) {
            torpedoes.splice(i, 1);
        }
    }
    
    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        explosion.time++;
        explosion.radius = (explosion.time / explosion.maxTime) * explosion.maxRadius;
        
        if (explosion.time >= explosion.maxTime) {
            explosions.splice(i, 1);
        }
    }
}

// Update enemies
function updateEnemies() {
    // Spawn new enemies
    if (Math.random() < 0.02) {
        createEnemy();
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        // Update position based on velocity
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        // Bounce off horizontal edges
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            enemy.vx = -enemy.vx; // Reverse horizontal direction
            // Keep enemy in bounds
            enemy.x = Math.max(0, Math.min(canvas.width - enemy.width, enemy.x));
        }
        
        // Remove enemies that are off screen (bottom or sides)
        if (enemy.y > canvas.height || enemy.x + enemy.width < 0 || enemy.x > canvas.width) {
            enemies.splice(i, 1);
        }
    }
}

// Update particles
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;
        // Apply slight gravity/friction to particles
        particles[i].vy += 0.1;
        particles[i].vx *= 0.98;
        particles[i].vy *= 0.98;
        particles[i].life--;

        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Update stars
function updateStars() {
    for (let star of stars) {
        star.y += star.speed;
        star.twinkle += star.twinkleSpeed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    }
}

// Update engine trails
function updateEngineTrails() {
    // Calculate horizontal offset based on player's horizontal velocity
    const horizontalOffset = player.vx * 2; // Slight shift based on movement direction
    
    // Add new trail point at player's engine position with horizontal offset
    engineTrails.push({
        x: player.x + horizontalOffset,
        y: player.y + player.height / 2,
        life: 20,
        vy: 2 // Trail moves downward
    });
    
    // Update and remove old trails (move them downward)
    for (let i = engineTrails.length - 1; i >= 0; i--) {
        engineTrails[i].y += engineTrails[i].vy;
        engineTrails[i].life--;
        if (engineTrails[i].life <= 0 || engineTrails[i].y > canvas.height) {
            engineTrails.splice(i, 1);
        }
    }
    
    // Limit trail length
    if (engineTrails.length > 10) {
        engineTrails.shift();
    }
}

// Collision detection
function checkCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(bullets[i], enemies[j])) {
                createParticles(enemies[j].x, enemies[j].y, enemies[j].color);
                bullets.splice(i, 1);
                enemies.splice(j, 1);
                score += 10;
                updateScore();
                break;
            }
        }
    }

    // Player vs Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (isColliding(player, enemies[i])) {
            createParticles(enemies[i].x, enemies[i].y, enemies[i].color);
            enemies.splice(i, 1);
            lives--;
            updateLives();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
}

// Collision detection helper
function isColliding(obj1, obj2) {
    // Get bounding boxes
    // Player and bullets use center coordinates, enemies use top-left
    const x1 = obj1.x - obj1.width / 2;
    const y1 = obj1.y - obj1.height / 2;
    const x2 = obj2.x; // Enemies use top-left coordinates
    const y2 = obj2.y;
    
    return x1 < x2 + obj2.width &&
           x1 + obj1.width > x2 &&
           y1 < y2 + obj2.height &&
           y1 + obj1.height > y2;
}

// Drawing functions
function drawStars() {
    // Draw nebula clouds first (background)
    for (let cloud of nebulaClouds) {
        const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
        gradient.addColorStop(0, cloud.color);
        gradient.addColorStop(1, 'transparent');
        ctx.globalAlpha = cloud.opacity;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    
    // Draw stars with twinkling effect (moderately bright)
    for (let star of stars) {
        const twinkle = Math.sin(star.twinkle) * 0.5 + 0.5; // 0 to 1
        const brightness = 0.35 + twinkle * 0.35; // Moderate brightness (0.35-0.7)
        
        let color;
        switch(star.color) {
            case 'blue': color = `rgba(125, 165, 220, ${brightness * 0.8})`; break;
            case 'yellow': color = `rgba(220, 220, 125, ${brightness * 0.8})`; break;
            case 'orange': color = `rgba(220, 165, 85, ${brightness * 0.8})`; break;
            default: color = `rgba(200, 200, 200, ${brightness * 0.8})`; // Moderately muted white
        }
        
        ctx.fillStyle = color;
        ctx.shadowBlur = star.size * 1.5; // Moderate glow
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.9, 0, Math.PI * 2); // Slightly smaller stars
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

// Draw engine trails
function drawEngineTrails() {
    if (engineTrails.length < 2) return;
    
    ctx.save();
    ctx.globalAlpha = 0.3; // Less prominent
    
    for (let i = 0; i < engineTrails.length - 1; i++) {
        const trail = engineTrails[i];
        const nextTrail = engineTrails[i + 1];
        const alpha = trail.life / 20;
        const width = 5 * alpha; // Thinner trail
        
        const gradient = ctx.createLinearGradient(trail.x, trail.y, nextTrail.x, nextTrail.y);
        gradient.addColorStop(0, `rgba(255, 102, 0, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 170, 0, ${alpha * 0.2})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(trail.x, trail.y);
        ctx.lineTo(nextTrail.x, nextTrail.y);
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawPlayer() {
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;
    
    ctx.save();
    
    // Calculate banking/rolling angle based on horizontal velocity
    const maxBankAngle = 25 * (Math.PI / 180);
    const bankAngle = Math.max(-maxBankAngle, Math.min(maxBankAngle, player.vx * 0.15));
    
    // 3D perspective scaling based on roll angle
    // When banking left (negative angle), left wing appears closer (larger), right appears farther (smaller)
    const leftScale = 1 + Math.sin(-bankAngle) * 0.3;  // Left wing scale
    const rightScale = 1 + Math.sin(bankAngle) * 0.3;   // Right wing scale
    
    // Main body (fuselage) - narrow, centered, no scaling - darker grey
    const bodyGradient = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
    bodyGradient.addColorStop(0, '#505050'); // Dark grey
    bodyGradient.addColorStop(0.5, '#404040'); // Darker grey
    bodyGradient.addColorStop(1, '#303030'); // Very dark grey
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(x, y - h/2); // Nose point
    ctx.lineTo(x - w/6, y - h/4); // Top left of body
    ctx.lineTo(x - w/6, y + h/4); // Bottom left of body
    ctx.lineTo(x - w/8, y + h/2); // Rear left
    ctx.lineTo(x + w/8, y + h/2); // Rear right
    ctx.lineTo(x + w/6, y + h/4); // Bottom right of body
    ctx.lineTo(x + w/6, y - h/4); // Top right of body
    ctx.closePath();
    ctx.fill();
    
    // Left wing - clearly separated, scales with banking - darker grey
    const wingGradient = ctx.createLinearGradient(x - w/2, y, x - w/6, y);
    wingGradient.addColorStop(0, '#404040');
    wingGradient.addColorStop(1, '#505050');
    ctx.fillStyle = wingGradient;
    ctx.beginPath();
    ctx.moveTo(x - w/6, y - h/6); // Connection to body
    ctx.lineTo(x - w/2 * leftScale, y - h/8); // Wing tip (scales)
    ctx.lineTo(x - w/2 * leftScale, y + h/8); // Wing tip bottom (scales)
    ctx.lineTo(x - w/6, y + h/6); // Connection to body
    ctx.closePath();
    ctx.fill();
    
    // Right wing - clearly separated, scales with banking - darker grey
    const rightWingGradient = ctx.createLinearGradient(x + w/6, y, x + w/2, y);
    rightWingGradient.addColorStop(0, '#505050');
    rightWingGradient.addColorStop(1, '#404040');
    ctx.fillStyle = rightWingGradient;
    ctx.beginPath();
    ctx.moveTo(x + w/6, y - h/6); // Connection to body
    ctx.lineTo(x + w/2 * rightScale, y - h/8); // Wing tip (scales)
    ctx.lineTo(x + w/2 * rightScale, y + h/8); // Wing tip bottom (scales)
    ctx.lineTo(x + w/6, y + h/6); // Connection to body
    ctx.closePath();
    ctx.fill();
    
    // Cockpit window (brighter area on body) - blue tint
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.ellipse(x, y - h/6, w/8, h/12, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Wing guns - colorful (cyan/blue) with pulsing animation
    const gunPulse = 0.7 + Math.sin(playerAnimationTime * 3) * 0.3;
    const gunGlowPulse = 6 + Math.sin(playerAnimationTime * 2.5) * 4;
    ctx.shadowBlur = gunGlowPulse;
    ctx.shadowColor = `rgba(0, 255, 255, ${0.6 + gunPulse * 0.4})`;
    ctx.fillStyle = `rgba(0, 170, 255, ${gunPulse})`;
    ctx.fillRect(x - w/2 * leftScale - 2, y - h/12, 4 * leftScale, h/6);
    ctx.fillRect(x + w/2 * rightScale - 2 * rightScale, y - h/12, 4 * rightScale, h/6);
    
    // Add energy glow around guns
    ctx.shadowBlur = 8 + Math.sin(playerAnimationTime * 4) * 3;
    ctx.shadowColor = `rgba(0, 255, 255, ${0.4 + gunPulse * 0.3})`;
    ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + gunPulse * 0.2})`;
    ctx.beginPath();
    ctx.arc(x - w/2 * leftScale, y, 3 * leftScale, 0, Math.PI * 2);
    ctx.arc(x + w/2 * rightScale, y, 3 * rightScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Engine glow (rear of body) - orange/red with pulsing animation
    const enginePulse = 0.7 + Math.sin(playerAnimationTime * 2) * 0.3;
    const engineGlowPulse = 15 + Math.sin(playerAnimationTime * 2.5) * 8;
    ctx.shadowBlur = engineGlowPulse;
    ctx.shadowColor = `rgba(255, 102, 0, ${0.7 + enginePulse * 0.3})`;
    ctx.fillStyle = `rgba(255, 68, 0, ${enginePulse})`;
    ctx.fillRect(x - w/10, y + h/2 - 2, w/5, 4);
    
    // Additional engine detail - bright orange core with pulsing
    const corePulse = 0.8 + Math.sin(playerAnimationTime * 3) * 0.2;
    ctx.shadowBlur = 8 + Math.sin(playerAnimationTime * 3.5) * 4;
    ctx.shadowColor = `rgba(255, 170, 0, ${0.8 + corePulse * 0.2})`;
    ctx.fillStyle = `rgba(255, 170, 0, ${corePulse})`;
    ctx.fillRect(x - w/12, y + h/2 - 1, w/6, 2);
    
    // Add extra engine particles/glow
    for (let i = 0; i < 2; i++) {
        const particleOffset = (playerAnimationTime * 0.5 + i * 0.5) % 1;
        const particleY = y + h/2 + particleOffset * 3;
        const particleSize = 2 * (1 - particleOffset) * (0.5 + Math.sin(playerAnimationTime * 4 + i) * 0.3);
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(255, 102, 0, ${0.6 * (1 - particleOffset)})`;
        ctx.fillStyle = `rgba(255, 170, 0, ${0.5 * (1 - particleOffset)})`;
        ctx.beginPath();
        ctx.arc(x, particleY, particleSize, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawBullets() {
    for (let bullet of bullets) {
        const x = bullet.x;
        const y = bullet.y;
        const w = bullet.width;
        const h = bullet.height;
        const time = bullet.time;
        
        // Calculate pulsing values using sine waves for smooth animation
        const pulseIntensity = 0.3 + Math.sin(time * 2) * 0.2; // Varies between 0.1 and 0.5
        const glowPulse = 15 + Math.sin(time * 2.5) * 10; // Glow size pulses
        const corePulse = 0.5 + Math.sin(time * 3) * 0.2; // Core brightness pulses
        
        // Create enhanced gradient for laser effect with pulsing
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        const brightness = 1 + pulseIntensity;
        gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`); // Bright white at top
        gradient.addColorStop(0.2, `rgba(255, 255, 136, ${brightness * 0.9})`); // Bright yellow
        gradient.addColorStop(0.4, `rgba(255, 255, 0, ${brightness * 0.8})`); // Yellow
        gradient.addColorStop(0.6, `rgba(255, 170, 0, ${brightness * 0.7})`); // Orange-yellow
        gradient.addColorStop(0.8, `rgba(255, 102, 0, ${brightness * 0.6})`); // Orange
        gradient.addColorStop(1, `rgba(255, 68, 0, ${brightness * 0.5})`); // Dark orange at bottom
        
        // Draw outer glow with pulsing intensity
        ctx.shadowBlur = 15 + glowPulse;
        ctx.shadowColor = `rgba(255, 255, 0, ${0.6 + pulseIntensity})`;
        ctx.fillStyle = gradient;
        ctx.fillRect(x - w / 2, y, w, h);
        
        // Draw middle layer with pulsing
        ctx.shadowBlur = 8 + glowPulse * 0.6;
        ctx.shadowColor = `rgba(255, 255, 136, ${0.7 + pulseIntensity})`;
        ctx.fillStyle = `rgba(255, 255, 136, ${0.8 + pulseIntensity})`;
        ctx.fillRect(x - w / 3, y, w * 2 / 3, h);
        
        // Draw bright white core with pulsing
        ctx.shadowBlur = 6 + glowPulse * 0.4;
        ctx.shadowColor = `rgba(255, 255, 255, ${0.8 + pulseIntensity})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${corePulse})`;
        ctx.fillRect(x - w / 4, y, w / 2, h);
        
        // Add animated energy pulse effect at the tip
        const tipSize = (w / 2) * (1 + Math.sin(time * 4) * 0.3);
        ctx.shadowBlur = 10 + Math.sin(time * 3) * 8;
        ctx.shadowColor = `rgba(255, 255, 255, ${0.9 + pulseIntensity})`;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + pulseIntensity})`;
        ctx.beginPath();
        ctx.arc(x, y, tipSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Add trailing energy particles (optional sci-fi effect)
        for (let i = 0; i < 3; i++) {
            const offset = (time * 2 + i) % 1;
            const particleY = y + h * offset;
            const particleSize = (w / 4) * (1 - offset) * (0.5 + Math.sin(time * 5 + i) * 0.3);
            ctx.shadowBlur = 5;
            ctx.shadowColor = `rgba(255, 255, 0, ${0.5 * (1 - offset)})`;
            ctx.fillStyle = `rgba(255, 255, 136, ${0.4 * (1 - offset)})`;
            ctx.beginPath();
            ctx.arc(x, particleY, particleSize, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Reset shadow
        ctx.shadowBlur = 0;
    }
}

function drawEnemies() {
    for (let enemy of enemies) {
        const x = enemy.x + enemy.width / 2;
        const y = enemy.y + enemy.height / 2;
        const w = enemy.width;
        const h = enemy.height;
        
        ctx.save();
        
        // Glow effect
        ctx.shadowBlur = 6;
        ctx.shadowColor = enemy.color;
        
        // Main body gradient
        const bodyGradient = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
        bodyGradient.addColorStop(0, '#ff6666');
        bodyGradient.addColorStop(0.5, enemy.color);
        bodyGradient.addColorStop(1, '#cc2222');
        ctx.fillStyle = bodyGradient;
        
        // Main body (diamond/arrow shape)
        ctx.beginPath();
        ctx.moveTo(x, y - h/2); // Top point
        ctx.lineTo(x - w/3, y - h/6); // Top left
        ctx.lineTo(x - w/2, y + h/4); // Mid left
        ctx.lineTo(x - w/4, y + h/2); // Bottom left
        ctx.lineTo(x + w/4, y + h/2); // Bottom right
        ctx.lineTo(x + w/2, y + h/4); // Mid right
        ctx.lineTo(x + w/3, y - h/6); // Top right
        ctx.closePath();
        ctx.fill();
        
        // Side panels/armor
        ctx.fillStyle = '#cc2222';
        ctx.fillRect(x - w/2, y - h/6, w/4, h/3);
        ctx.fillRect(x + w/4, y - h/6, w/4, h/3);
        
        // Central core (darker)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aa0000';
        ctx.beginPath();
        ctx.ellipse(x, y, w/3, h/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Engine glow (rear)
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4444';
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(x - w/6, y + h/2 - 2, w/3, 3);
        
        ctx.restore();
    }
}

function drawTorpedoes() {
    for (let torpedo of torpedoes) {
        if (!torpedo.exploded) {
            const x = torpedo.x;
            const y = torpedo.y;
            const w = torpedo.width;
            const h = torpedo.height;
            
            // Draw trail
            if (torpedo.trail && torpedo.trail.length > 1) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                for (let i = 0; i < torpedo.trail.length - 1; i++) {
                    const point = torpedo.trail[i];
                    const nextPoint = torpedo.trail[i + 1];
                    const alpha = i / torpedo.trail.length;
                    const width = 6 * alpha;
                    
                    const gradient = ctx.createLinearGradient(point.x, point.y, nextPoint.x, nextPoint.y);
                    gradient.addColorStop(0, `rgba(0, 255, 0, ${alpha * 0.6})`);
                    gradient.addColorStop(1, `rgba(0, 255, 150, ${alpha * 0.3})`);
                    
                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = width;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(point.x, point.y);
                    ctx.lineTo(nextPoint.x, nextPoint.y);
                    ctx.stroke();
                }
                ctx.restore();
            }
            
            // Draw torpedo body with enhanced glow
            const gradient = ctx.createLinearGradient(x, y, x, y + h);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#00ff88');
            gradient.addColorStop(1, '#00aa44');
            
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ff00';
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - w/2, y + h);
            ctx.lineTo(x + w/2, y + h);
            ctx.closePath();
            ctx.fill();
            
            // Draw bright tip with pulsing
            const tipPulse = 1 + Math.sin(torpedo.time * 0.3) * 0.2;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ffffff';
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, (w/3) * tipPulse, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
    }
    
    // Draw explosions
    for (let explosion of explosions) {
        const progress = explosion.time / explosion.maxTime;
        const alpha = 1 - progress;
        const radius = explosion.radius;
        
        // Shockwave ring
        ctx.globalAlpha = alpha * 0.3;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        
        // Outer explosion ring
        ctx.globalAlpha = alpha * 0.7;
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff6600';
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Middle ring
        ctx.globalAlpha = alpha * 0.9;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffaa00';
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright ring
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00';
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Bright white core
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

function drawParticles() {
    for (let particle of particles) {
        const alpha = particle.life / particle.maxLife;
        const size = particle.size * alpha; // Shrink as particle fades
        
        // Draw particle with glow effect
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow and alpha
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// Update HUD
function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateLives() {
    document.getElementById('lives').textContent = lives;
}

// Game state functions
function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    bullets = [];
    enemies = [];
    particles = [];
    torpedoes = [];
    explosions = [];
    engineTrails = [];
    torpedoCooldown = 0;
    player.vx = 0;
    player.vy = 0;
    updateScore();
    updateLives();
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    gameLoop();
}

function gameOver() {
    gameState = 'gameOver';
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

function resetGame() {
    player.x = canvas.width / 2;
    player.y = canvas.height - 80;
    player.vx = 0;
    player.vy = 0;
    startGame();
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', resetGame);

// Game loop
function gameLoop() {
    if (gameState !== 'playing') return;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update animation time for player ship effects
    playerAnimationTime += 0.15;

    // Update
    updateStars();
    updatePlayer();
    updateEngineTrails();
    updateAutoShoot();
    updateBullets();
    updateTorpedoes();
    updateEnemies();
    updateParticles();
    checkCollisions();

    // Draw
    drawStars();
    drawEngineTrails();
    drawBullets();
    drawTorpedoes();
    drawEnemies();
    drawPlayer();
    drawParticles();

    requestAnimationFrame(gameLoop);
}

// Initialize
initStars();
drawStars();

