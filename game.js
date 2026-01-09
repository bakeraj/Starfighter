// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const logicalWidth = 800;
const logicalHeight = 600;
const dpr = window.devicePixelRatio || 1;
canvas.width = logicalWidth * dpr;
canvas.height = logicalHeight * dpr;
canvas.style.width = `${logicalWidth}px`;
canvas.style.height = `${logicalHeight}px`;
ctx.scale(dpr, dpr);
const glowCanvas = document.createElement('canvas');
const glowCtx = glowCanvas.getContext('2d');
glowCanvas.width = logicalWidth * dpr;
glowCanvas.height = logicalHeight * dpr;
glowCtx.scale(dpr, dpr);

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
    x: logicalWidth / 2,
    y: logicalHeight - 80,
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
let nebulaTexture = null; // Offscreen nebula texture

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
    const starTypes = ['white', 'blue', 'yellow', 'orange'];
    const layerConfigs = [
        {
            name: 'far',
            count: 60,
            sizeRange: [0.5, 1.4],
            speedRange: [0.2, 0.7],
            baseBrightness: 0.25,
            twinkleStrength: 0.25,
            twinkleSpeedRange: [0.01, 0.03]
        },
        {
            name: 'mid',
            count: 55,
            sizeRange: [0.9, 2.1],
            speedRange: [0.7, 1.4],
            baseBrightness: 0.35,
            twinkleStrength: 0.35,
            twinkleSpeedRange: [0.03, 0.06]
        },
        {
            name: 'near',
            count: 40,
            sizeRange: [1.5, 3.1],
            speedRange: [1.4, 2.4],
            baseBrightness: 0.45,
            twinkleStrength: 0.45,
            twinkleSpeedRange: [0.05, 0.1]
        }
    ];

    stars = layerConfigs.map((layer) => {
        const layerStars = [];
        for (let i = 0; i < layer.count; i++) {
            layerStars.push({
                x: Math.random() * logicalWidth,
                y: Math.random() * logicalHeight,
                size: Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]) + layer.sizeRange[0],
                speed: Math.random() * (layer.speedRange[1] - layer.speedRange[0]) + layer.speedRange[0],
                color: starTypes[Math.floor(Math.random() * starTypes.length)],
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * (layer.twinkleSpeedRange[1] - layer.twinkleSpeedRange[0]) + layer.twinkleSpeedRange[0]
            });
        }
        return {
            name: layer.name,
            baseBrightness: layer.baseBrightness,
            twinkleStrength: layer.twinkleStrength,
            stars: layerStars
        };
    });

    const nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.width = logicalWidth;
    nebulaCanvas.height = logicalHeight;
    const nebulaCtx = nebulaCanvas.getContext('2d');
    nebulaCtx.clearRect(0, 0, logicalWidth, logicalHeight);

    const nebulaColors = [
        'rgba(120, 70, 200, 0.45)',
        'rgba(70, 140, 220, 0.4)',
        'rgba(180, 80, 140, 0.38)'
    ];
    for (let i = 0; i < 9; i++) {
        const x = Math.random() * logicalWidth;
        const y = Math.random() * logicalHeight;
        const radius = Math.random() * 220 + 180;
        const gradient = nebulaCtx.createRadialGradient(x, y, 0, x, y, radius);
        const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.55, 'rgba(20, 10, 40, 0.18)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        nebulaCtx.fillStyle = gradient;
        nebulaCtx.beginPath();
        nebulaCtx.arc(x, y, radius, 0, Math.PI * 2);
        nebulaCtx.fill();
    }

    nebulaTexture = {
        canvas: nebulaCanvas,
        offsetX: 0,
        offsetY: 0,
        driftX: 0.02,
        driftY: 0.01,
        alpha: 0.38
    };
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
        time: 0, // Animation time for pulsing effect
        damage: 1 // Damage per bullet
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
    const health = Math.floor(Math.random() * 6) + 5; // 5-10 health points
    enemies.push({
        x: Math.random() * (logicalWidth - 40),
        y: -40,
        width: 40,
        height: 40,
        vx: horizontalSpeed, // Horizontal velocity
        vy: baseSpeed, // Vertical velocity
        color: '#ff4444',
        health: health,
        maxHealth: health,
        damageFlash: 0 // For visual feedback when hit
    });
}

// Create small hit particles (for when enemy is hit but not destroyed)
function createHitParticles(x, y, color) {
    const hitColors = [color, '#ffaa44', '#ffff44'];
    const particleCount = 6; // Small number of particles
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.3;
        const speed = Math.random() * 3 + 1; // Slower, smaller particles
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 15 + Math.random() * 10,
            maxLife: 15 + Math.random() * 10,
            size: Math.random() * 2 + 1, // Smaller particles
            color: hitColors[Math.floor(Math.random() * hitColors.length)]
        });
    }
}

// Create full particle explosion (for when enemy is destroyed)
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
    if (player.x + player.width / 2 > logicalWidth) {
        player.x = logicalWidth - player.width / 2;
        player.vx = 0;
    }
    if (player.y - player.height / 2 < 0) {
        player.y = player.height / 2;
        player.vy = 0;
    }
    if (player.y + player.height / 2 > logicalHeight) {
        player.y = logicalHeight - player.height / 2;
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
                        // Deal damage (torpedoes deal 8 damage)
                        enemy.health -= 8;
                        enemy.damageFlash = 20;
                        
                        // Check if enemy is destroyed
                        if (enemy.health <= 0) {
                            // Full explosion when destroyed
                            createParticles(enemyCenterX, enemyCenterY, enemy.color);
                            enemies.splice(j, 1);
                            score += 10;
                            updateScore();
                        } else {
                            // Small hit particles when hit but not destroyed
                            createHitParticles(enemyCenterX, enemyCenterY, '#ffaa00');
                        }
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
        
        // Update damage flash counter
        if (enemy.damageFlash > 0) {
            enemy.damageFlash--;
        }
        
        // Update position based on velocity
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        // Bounce off horizontal edges
        if (enemy.x <= 0 || enemy.x + enemy.width >= logicalWidth) {
            enemy.vx = -enemy.vx; // Reverse horizontal direction
            // Keep enemy in bounds
            enemy.x = Math.max(0, Math.min(logicalWidth - enemy.width, enemy.x));
        }
        
        // Remove enemies that are off screen (bottom or sides)
        if (enemy.y > logicalHeight || enemy.x + enemy.width < 0 || enemy.x > logicalWidth) {
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
    for (let layer of stars) {
        for (let star of layer.stars) {
            star.y += star.speed;
            star.twinkle += star.twinkleSpeed;
            if (star.y > logicalHeight) {
                star.y = 0;
                star.x = Math.random() * logicalWidth;
            }
        }
    }

    if (nebulaTexture) {
        nebulaTexture.offsetX = (nebulaTexture.offsetX + nebulaTexture.driftX) % logicalWidth;
        nebulaTexture.offsetY = (nebulaTexture.offsetY + nebulaTexture.driftY) % logicalHeight;
    }
}

// Update engine trails
function updateEngineTrails() {
    const speed = Math.hypot(player.vx, player.vy);
    const speedFactor = Math.min(speed / player.maxSpeed, 1.6);
    // Calculate horizontal offset based on player's horizontal velocity
    const rawOffset = player.vx * (0.8 + speedFactor * 0.4); // Slight shift based on movement direction
    const maxOffset = player.width * 0.15;
    const horizontalOffset = Math.max(-maxOffset, Math.min(maxOffset, rawOffset));
    const trailLife = 7 + speedFactor * 5;
    const trailVy = 1 + speedFactor * 1.1;
    const trailSegments = 1 + Math.floor(speedFactor);
    const trailX = player.x + horizontalOffset;
    const trailY = player.y + player.height / 2 - 3;
    
    // Add new trail point at player's engine position with horizontal offset
    const lastTrail = engineTrails[engineTrails.length - 1];
    const startX = lastTrail ? lastTrail.x : trailX;
    const startY = lastTrail ? lastTrail.y : trailY;
    for (let i = 1; i <= trailSegments; i++) {
        const t = i / trailSegments;
        engineTrails.push({
            x: startX + (trailX - startX) * t,
            y: startY + (trailY - startY) * t,
            life: trailLife,
            maxLife: trailLife,
            vy: trailVy // Trail moves downward
        });
    }
    
    // Update and remove old trails (move them downward)
    for (let i = engineTrails.length - 1; i >= 0; i--) {
        engineTrails[i].y += engineTrails[i].vy;
        engineTrails[i].life--;
        if (engineTrails[i].life <= 0 || engineTrails[i].y > logicalHeight) {
            engineTrails.splice(i, 1);
        }
    }
    
    // Limit trail length
    const maxTrails = 5 + Math.round(speedFactor * 5);
    while (engineTrails.length > maxTrails) {
        engineTrails.shift();
    }
}

// Collision detection
function checkCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (isColliding(bullets[i], enemies[j])) {
                const enemy = enemies[j];
                const bullet = bullets[i];
                
                // Damage the enemy
                enemy.health -= bullet.damage;
                enemy.damageFlash = 20; // Flash white when hit (longer duration)
                bullets.splice(i, 1);
                
                // Check if enemy is destroyed
                if (enemy.health <= 0) {
                    // Full explosion when destroyed
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
                    enemies.splice(j, 1);
                    score += 10;
                    updateScore();
                } else {
                    // Small hit particles when hit but not destroyed
                    createHitParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, bullet.color);
                }
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
    if (nebulaTexture) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = nebulaTexture.alpha;
        const nebulaX = -nebulaTexture.offsetX;
        const nebulaY = -nebulaTexture.offsetY;
        ctx.drawImage(nebulaTexture.canvas, nebulaX, nebulaY);
        ctx.drawImage(nebulaTexture.canvas, nebulaX + logicalWidth, nebulaY);
        ctx.drawImage(nebulaTexture.canvas, nebulaX, nebulaY + logicalHeight);
        ctx.drawImage(nebulaTexture.canvas, nebulaX + logicalWidth, nebulaY + logicalHeight);
        ctx.restore();
    }

    for (let layer of stars) {
        for (let star of layer.stars) {
            const twinkle = Math.sin(star.twinkle) * 0.5 + 0.5; // 0 to 1
            const brightness = layer.baseBrightness + twinkle * layer.twinkleStrength;
            
            let color;
            switch(star.color) {
                case 'blue': color = `rgba(125, 165, 220, ${brightness})`; break;
                case 'yellow': color = `rgba(220, 220, 125, ${brightness})`; break;
                case 'orange': color = `rgba(220, 165, 85, ${brightness})`; break;
                default: color = `rgba(200, 200, 200, ${brightness})`;
            }
            
            ctx.fillStyle = color;
            ctx.shadowBlur = star.size * 1.4;
            ctx.shadowColor = color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.shadowBlur = 0;
}

// Draw engine trails
function drawEngineTrails(targetCtx = ctx) {
    if (engineTrails.length < 2) return;
    
    const drawCtx = targetCtx;
    const speed = Math.hypot(player.vx, player.vy);
    const speedFactor = Math.min(speed / player.maxSpeed, 1.6);
    const colorShift = Math.min(speedFactor / 1.4, 1);
    const startColor = { r: 255, g: 102, b: 0 };
    const endColor = { r: 255, g: 230, b: 180 };
    const flameColor = {
        r: Math.round(startColor.r + (endColor.r - startColor.r) * colorShift),
        g: Math.round(startColor.g + (endColor.g - startColor.g) * colorShift),
        b: Math.round(startColor.b + (endColor.b - startColor.b) * colorShift)
    };

    drawCtx.save();
    drawCtx.globalAlpha = 0.2 + speedFactor * 0.18; // Less prominent
    
    for (let i = 0; i < engineTrails.length - 1; i++) {
        const trail = engineTrails[i];
        const nextTrail = engineTrails[i + 1];
        const lifeRatio = trail.life / (trail.maxLife || 20);
        const baseFactor = i / (engineTrails.length - 1);
        const baseBoost = 0.45 + baseFactor * 1.05;
        const alpha = Math.pow(lifeRatio, 1.8) * (0.35 + speedFactor * 0.25);
        const width = (3.2 + speedFactor * 3.2) * alpha * baseBoost;
        
        const gradient = drawCtx.createLinearGradient(trail.x, trail.y, nextTrail.x, nextTrail.y);
        gradient.addColorStop(0, `rgba(${flameColor.r}, ${flameColor.g}, ${flameColor.b}, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(255, 170, 0, ${alpha * 0.2})`);
        
        drawCtx.strokeStyle = gradient;
        drawCtx.lineWidth = width;
        drawCtx.lineCap = 'round';
        drawCtx.beginPath();
        drawCtx.moveTo(trail.x, trail.y);
        drawCtx.lineTo(nextTrail.x, nextTrail.y);
        drawCtx.stroke();
    }
    
    drawCtx.restore();
}

function drawPlayerEngineGlow(targetCtx = ctx) {
    const drawCtx = targetCtx;
    const x = player.x;
    const y = player.y;
    const w = player.width;
    const h = player.height;

    // Engine glow (rear of body) - orange/red with pulsing animation
    const enginePulse = 0.7 + Math.sin(playerAnimationTime * 2) * 0.3;
    const engineGlowPulse = 15 + Math.sin(playerAnimationTime * 2.5) * 8;
    drawCtx.shadowBlur = engineGlowPulse;
    drawCtx.shadowColor = `rgba(255, 102, 0, ${0.7 + enginePulse * 0.3})`;
    drawCtx.fillStyle = `rgba(255, 68, 0, ${enginePulse})`;
    drawCtx.fillRect(x - w / 10, y + h / 2 - 2, w / 5, 4);

    // Additional engine detail - bright orange core with pulsing
    const corePulse = 0.8 + Math.sin(playerAnimationTime * 3) * 0.2;
    drawCtx.shadowBlur = 8 + Math.sin(playerAnimationTime * 3.5) * 4;
    drawCtx.shadowColor = `rgba(255, 170, 0, ${0.8 + corePulse * 0.2})`;
    drawCtx.fillStyle = `rgba(255, 170, 0, ${corePulse})`;
    drawCtx.fillRect(x - w / 12, y + h / 2 - 1, w / 6, 2);

    // Add extra engine particles/glow
    for (let i = 0; i < 2; i++) {
        const particleOffset = (playerAnimationTime * 0.5 + i * 0.5) % 1;
        const particleY = y + h / 2 + particleOffset * 3;
        const particleSize = 2 * (1 - particleOffset) * (0.5 + Math.sin(playerAnimationTime * 4 + i) * 0.3);
        drawCtx.shadowBlur = 6;
        drawCtx.shadowColor = `rgba(255, 102, 0, ${0.6 * (1 - particleOffset)})`;
        drawCtx.fillStyle = `rgba(255, 170, 0, ${0.5 * (1 - particleOffset)})`;
        drawCtx.beginPath();
        drawCtx.arc(x, particleY, particleSize, 0, Math.PI * 2);
        drawCtx.fill();
    }
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

    // Directional lighting highlights (top-left) and rim shadow (bottom-right)
    ctx.shadowBlur = 0;
    const bodyHighlight = ctx.createLinearGradient(
        x - w / 4,
        y - h / 2,
        x + w / 4,
        y + h / 2
    );
    bodyHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    bodyHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    bodyHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bodyHighlight;
    ctx.beginPath();
    ctx.moveTo(x, y - h/2);
    ctx.lineTo(x - w/6, y - h/4);
    ctx.lineTo(x - w/6, y + h/4);
    ctx.lineTo(x - w/8, y + h/2);
    ctx.lineTo(x + w/8, y + h/2);
    ctx.lineTo(x + w/6, y + h/4);
    ctx.lineTo(x + w/6, y - h/4);
    ctx.closePath();
    ctx.fill();

    const bodyShadow = ctx.createLinearGradient(
        x + w / 3,
        y + h / 2,
        x - w / 3,
        y - h / 2
    );
    bodyShadow.addColorStop(0, 'rgba(0, 0, 0, 0.28)');
    bodyShadow.addColorStop(0.55, 'rgba(0, 0, 0, 0.12)');
    bodyShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bodyShadow;
    ctx.beginPath();
    ctx.moveTo(x, y - h/2);
    ctx.lineTo(x - w/6, y - h/4);
    ctx.lineTo(x - w/6, y + h/4);
    ctx.lineTo(x - w/8, y + h/2);
    ctx.lineTo(x + w/8, y + h/2);
    ctx.lineTo(x + w/6, y + h/4);
    ctx.lineTo(x + w/6, y - h/4);
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

    const leftWingHighlight = ctx.createLinearGradient(
        x - w / 2 * leftScale,
        y - h / 6,
        x - w / 6,
        y + h / 6
    );
    leftWingHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    leftWingHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = leftWingHighlight;
    ctx.beginPath();
    ctx.moveTo(x - w/6, y - h/6);
    ctx.lineTo(x - w/2 * leftScale, y - h/8);
    ctx.lineTo(x - w/2 * leftScale, y + h/8);
    ctx.lineTo(x - w/6, y + h/6);
    ctx.closePath();
    ctx.fill();

    const leftWingShadow = ctx.createLinearGradient(
        x - w / 6,
        y + h / 6,
        x - w / 2 * leftScale,
        y - h / 6
    );
    leftWingShadow.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
    leftWingShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = leftWingShadow;
    ctx.beginPath();
    ctx.moveTo(x - w/6, y - h/6);
    ctx.lineTo(x - w/2 * leftScale, y - h/8);
    ctx.lineTo(x - w/2 * leftScale, y + h/8);
    ctx.lineTo(x - w/6, y + h/6);
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

    const rightWingHighlight = ctx.createLinearGradient(
        x + w / 6,
        y - h / 6,
        x + w / 2 * rightScale,
        y + h / 6
    );
    rightWingHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    rightWingHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = rightWingHighlight;
    ctx.beginPath();
    ctx.moveTo(x + w/6, y - h/6);
    ctx.lineTo(x + w/2 * rightScale, y - h/8);
    ctx.lineTo(x + w/2 * rightScale, y + h/8);
    ctx.lineTo(x + w/6, y + h/6);
    ctx.closePath();
    ctx.fill();

    const rightWingShadow = ctx.createLinearGradient(
        x + w / 2 * rightScale,
        y + h / 6,
        x + w / 6,
        y - h / 6
    );
    rightWingShadow.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
    rightWingShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rightWingShadow;
    ctx.beginPath();
    ctx.moveTo(x + w/6, y - h/6);
    ctx.lineTo(x + w/2 * rightScale, y - h/8);
    ctx.lineTo(x + w/2 * rightScale, y + h/8);
    ctx.lineTo(x + w/6, y + h/6);
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
    
    drawPlayerEngineGlow(ctx);
    
    ctx.restore();
}

function drawBullets(targetCtx = ctx) {
    const drawCtx = targetCtx;

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
        const gradient = drawCtx.createLinearGradient(x, y, x, y + h);
        const brightness = 1 + pulseIntensity;
        gradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`); // Bright white at top
        gradient.addColorStop(0.2, `rgba(255, 255, 136, ${brightness * 0.9})`); // Bright yellow
        gradient.addColorStop(0.4, `rgba(255, 255, 0, ${brightness * 0.8})`); // Yellow
        gradient.addColorStop(0.6, `rgba(255, 170, 0, ${brightness * 0.7})`); // Orange-yellow
        gradient.addColorStop(0.8, `rgba(255, 102, 0, ${brightness * 0.6})`); // Orange
        gradient.addColorStop(1, `rgba(255, 68, 0, ${brightness * 0.5})`); // Dark orange at bottom
        
        // Draw outer glow with pulsing intensity
        drawCtx.shadowBlur = 15 + glowPulse;
        drawCtx.shadowColor = `rgba(255, 255, 0, ${0.6 + pulseIntensity})`;
        drawCtx.fillStyle = gradient;
        drawCtx.fillRect(x - w / 2, y, w, h);
        
        // Draw middle layer with pulsing
        drawCtx.shadowBlur = 8 + glowPulse * 0.6;
        drawCtx.shadowColor = `rgba(255, 255, 136, ${0.7 + pulseIntensity})`;
        drawCtx.fillStyle = `rgba(255, 255, 136, ${0.8 + pulseIntensity})`;
        drawCtx.fillRect(x - w / 3, y, w * 2 / 3, h);
        
        // Draw bright white core with pulsing
        drawCtx.shadowBlur = 6 + glowPulse * 0.4;
        drawCtx.shadowColor = `rgba(255, 255, 255, ${0.8 + pulseIntensity})`;
        drawCtx.fillStyle = `rgba(255, 255, 255, ${corePulse})`;
        drawCtx.fillRect(x - w / 4, y, w / 2, h);
        
        // Add animated energy pulse effect at the tip
        const tipSize = (w / 2) * (1 + Math.sin(time * 4) * 0.3);
        drawCtx.shadowBlur = 10 + Math.sin(time * 3) * 8;
        drawCtx.shadowColor = `rgba(255, 255, 255, ${0.9 + pulseIntensity})`;
        drawCtx.fillStyle = `rgba(255, 255, 255, ${0.7 + pulseIntensity})`;
        drawCtx.beginPath();
        drawCtx.arc(x, y, tipSize, 0, Math.PI * 2);
        drawCtx.fill();
        
        // Add trailing energy particles (optional sci-fi effect)
        for (let i = 0; i < 3; i++) {
            const offset = (time * 2 + i) % 1;
            const particleY = y + h * offset;
            const particleSize = (w / 4) * (1 - offset) * (0.5 + Math.sin(time * 5 + i) * 0.3);
            drawCtx.shadowBlur = 5;
            drawCtx.shadowColor = `rgba(255, 255, 0, ${0.5 * (1 - offset)})`;
            drawCtx.fillStyle = `rgba(255, 255, 136, ${0.4 * (1 - offset)})`;
            drawCtx.beginPath();
            drawCtx.arc(x, particleY, particleSize, 0, Math.PI * 2);
            drawCtx.fill();
        }
        
        // Reset shadow
        drawCtx.shadowBlur = 0;
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
        
        // Calculate flash intensity (slower fade)
        const flashIntensity = enemy.damageFlash > 0 ? enemy.damageFlash / 20 : 0;
        
        // Main body gradient (with flash effect if damaged)
        const bodyGradient = ctx.createLinearGradient(x, y - h/2, x, y + h/2);
        if (flashIntensity > 0) {
            // Flash effect - blend white with enemy colors
            const r1 = Math.floor(102 + (255 - 102) * flashIntensity);
            const r2 = Math.floor(68 + (255 - 68) * flashIntensity);
            const r3 = Math.floor(34 + (255 - 34) * flashIntensity);
            bodyGradient.addColorStop(0, `rgb(255, ${r1}, ${r1})`);
            bodyGradient.addColorStop(0.5, `rgb(255, ${r2}, ${r2})`);
            bodyGradient.addColorStop(1, `rgb(255, ${r3}, ${r3})`);
        } else {
            bodyGradient.addColorStop(0, '#ff6666');
            bodyGradient.addColorStop(0.5, enemy.color);
            bodyGradient.addColorStop(1, '#cc2222');
        }
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

        // Directional highlight (top-left) and rim shadow (bottom-right)
        ctx.shadowBlur = 0;
        const enemyHighlight = ctx.createLinearGradient(
            x - w / 3,
            y - h / 2,
            x + w / 3,
            y + h / 2
        );
        enemyHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        enemyHighlight.addColorStop(0.55, 'rgba(255, 255, 255, 0.08)');
        enemyHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = enemyHighlight;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2);
        ctx.lineTo(x - w/3, y - h/6);
        ctx.lineTo(x - w/2, y + h/4);
        ctx.lineTo(x - w/4, y + h/2);
        ctx.lineTo(x + w/4, y + h/2);
        ctx.lineTo(x + w/2, y + h/4);
        ctx.lineTo(x + w/3, y - h/6);
        ctx.closePath();
        ctx.fill();

        const enemyShadow = ctx.createLinearGradient(
            x + w / 3,
            y + h / 2,
            x - w / 3,
            y - h / 2
        );
        enemyShadow.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        enemyShadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.12)');
        enemyShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = enemyShadow;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2);
        ctx.lineTo(x - w/3, y - h/6);
        ctx.lineTo(x - w/2, y + h/4);
        ctx.lineTo(x - w/4, y + h/2);
        ctx.lineTo(x + w/4, y + h/2);
        ctx.lineTo(x + w/2, y + h/4);
        ctx.lineTo(x + w/3, y - h/6);
        ctx.closePath();
        ctx.fill();
        
        // Side panels/armor (with flash)
        if (flashIntensity > 0) {
            const r = Math.floor(34 + (255 - 34) * flashIntensity);
            ctx.fillStyle = `rgb(255, ${r}, ${r})`;
        } else {
            ctx.fillStyle = '#cc2222';
        }
        ctx.fillRect(x - w/2, y - h/6, w/4, h/3);
        ctx.fillRect(x + w/4, y - h/6, w/4, h/3);

        const panelHighlight = ctx.createLinearGradient(
            x - w / 2,
            y - h / 6,
            x - w / 4,
            y + h / 6
        );
        panelHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        panelHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = panelHighlight;
        ctx.fillRect(x - w/2, y - h/6, w/4, h/3);
        const panelHighlightRight = ctx.createLinearGradient(
            x + w / 4,
            y - h / 6,
            x + w / 2,
            y + h / 6
        );
        panelHighlightRight.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
        panelHighlightRight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = panelHighlightRight;
        ctx.fillRect(x + w/4, y - h/6, w/4, h/3);

        const panelShadow = ctx.createLinearGradient(
            x - w / 4,
            y + h / 6,
            x - w / 2,
            y - h / 6
        );
        panelShadow.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
        panelShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = panelShadow;
        ctx.fillRect(x - w/2, y - h/6, w/4, h/3);
        const panelShadowRight = ctx.createLinearGradient(
            x + w / 2,
            y + h / 6,
            x + w / 4,
            y - h / 6
        );
        panelShadowRight.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
        panelShadowRight.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = panelShadowRight;
        ctx.fillRect(x + w/4, y - h/6, w/4, h/3);
        
        // Central core (darker, with flash)
        ctx.shadowBlur = 0;
        if (flashIntensity > 0) {
            const r = Math.floor(170 + (255 - 170) * flashIntensity);
            ctx.fillStyle = `rgb(255, ${r}, ${r})`;
        } else {
            ctx.fillStyle = '#aa0000';
        }
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

function drawTorpedoes(targetCtx = ctx) {
    const drawCtx = targetCtx;

    for (let torpedo of torpedoes) {
        if (!torpedo.exploded) {
            const x = torpedo.x;
            const y = torpedo.y;
            const w = torpedo.width;
            const h = torpedo.height;
            
            // Draw trail
            if (torpedo.trail && torpedo.trail.length > 1) {
                drawCtx.save();
                drawCtx.globalAlpha = 0.5;
                for (let i = 0; i < torpedo.trail.length - 1; i++) {
                    const point = torpedo.trail[i];
                    const nextPoint = torpedo.trail[i + 1];
                    const alpha = i / torpedo.trail.length;
                    const width = 6 * alpha;
                    
                    const gradient = drawCtx.createLinearGradient(point.x, point.y, nextPoint.x, nextPoint.y);
                    gradient.addColorStop(0, `rgba(0, 255, 0, ${alpha * 0.6})`);
                    gradient.addColorStop(1, `rgba(0, 255, 150, ${alpha * 0.3})`);
                    
                    drawCtx.strokeStyle = gradient;
                    drawCtx.lineWidth = width;
                    drawCtx.lineCap = 'round';
                    drawCtx.beginPath();
                    drawCtx.moveTo(point.x, point.y);
                    drawCtx.lineTo(nextPoint.x, nextPoint.y);
                    drawCtx.stroke();
                }
                drawCtx.restore();
            }
            
            // Draw torpedo body with enhanced glow
            const gradient = drawCtx.createLinearGradient(x, y, x, y + h);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, '#00ff88');
            gradient.addColorStop(1, '#00aa44');
            
            drawCtx.shadowBlur = 15;
            drawCtx.shadowColor = '#00ff00';
            drawCtx.fillStyle = gradient;
            drawCtx.beginPath();
            drawCtx.moveTo(x, y);
            drawCtx.lineTo(x - w / 2, y + h);
            drawCtx.lineTo(x + w / 2, y + h);
            drawCtx.closePath();
            drawCtx.fill();
            
            // Draw bright tip with pulsing
            const tipPulse = 1 + Math.sin(torpedo.time * 0.3) * 0.2;
            drawCtx.shadowBlur = 20;
            drawCtx.shadowColor = '#ffffff';
            drawCtx.fillStyle = '#ffffff';
            drawCtx.beginPath();
            drawCtx.arc(x, y, (w / 3) * tipPulse, 0, Math.PI * 2);
            drawCtx.fill();
            
            drawCtx.shadowBlur = 0;
        }
    }
    
    // Draw explosions
    for (let explosion of explosions) {
        const progress = explosion.time / explosion.maxTime;
        const alpha = 1 - progress;
        const radius = explosion.radius;
        
        // Shockwave ring
        drawCtx.globalAlpha = alpha * 0.3;
        drawCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        drawCtx.lineWidth = 3;
        drawCtx.beginPath();
        drawCtx.arc(explosion.x, explosion.y, radius * 0.9, 0, Math.PI * 2);
        drawCtx.stroke();
        
        // Outer explosion ring
        drawCtx.globalAlpha = alpha * 0.7;
        drawCtx.shadowBlur = 30;
        drawCtx.shadowColor = '#ff6600';
        drawCtx.fillStyle = '#ff4400';
        drawCtx.beginPath();
        drawCtx.arc(explosion.x, explosion.y, radius, 0, Math.PI * 2);
        drawCtx.fill();
        
        // Middle ring
        drawCtx.globalAlpha = alpha * 0.9;
        drawCtx.shadowBlur = 20;
        drawCtx.shadowColor = '#ffaa00';
        drawCtx.fillStyle = '#ff8800';
        drawCtx.beginPath();
        drawCtx.arc(explosion.x, explosion.y, radius * 0.7, 0, Math.PI * 2);
        drawCtx.fill();
        
        // Inner bright ring
        drawCtx.globalAlpha = alpha;
        drawCtx.shadowBlur = 15;
        drawCtx.shadowColor = '#ffff00';
        drawCtx.fillStyle = '#ffff88';
        drawCtx.beginPath();
        drawCtx.arc(explosion.x, explosion.y, radius * 0.5, 0, Math.PI * 2);
        drawCtx.fill();
        
        // Bright white core
        drawCtx.globalAlpha = alpha;
        drawCtx.shadowBlur = 10;
        drawCtx.shadowColor = '#ffffff';
        drawCtx.fillStyle = '#ffffff';
        drawCtx.beginPath();
        drawCtx.arc(explosion.x, explosion.y, radius * 0.3, 0, Math.PI * 2);
        drawCtx.fill();
        
        drawCtx.shadowBlur = 0;
        drawCtx.globalAlpha = 1;
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

function drawVignette() {
    const gradient = ctx.createRadialGradient(
        logicalWidth / 2,
        logicalHeight / 2,
        logicalHeight * 0.2,
        logicalWidth / 2,
        logicalHeight / 2,
        logicalHeight * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    ctx.restore();
}

function renderGlowPass() {
    glowCtx.clearRect(0, 0, logicalWidth, logicalHeight);
    drawEngineTrails(glowCtx);
    drawBullets(glowCtx);
    drawTorpedoes(glowCtx);
    drawPlayerEngineGlow(glowCtx);

    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(glowCanvas, 0, 0, logicalWidth, logicalHeight);
    ctx.restore();
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
    player.x = logicalWidth / 2;
    player.y = logicalHeight - 80;
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
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

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
    renderGlowPass();
    drawVignette();

    requestAnimationFrame(gameLoop);
}

// Initialize
initStars();
drawStars();
