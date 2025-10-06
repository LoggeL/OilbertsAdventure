// ===== CONSTANTS =====
const GRAVITY = 1200 // Units per second squared
const JUMP_FORCE = -600 // Units per second
const PLAYER_SPEED = 400 // Units per second
const INITIAL_PLATFORM_SPEED = 250 // Units per second
const SPEED_INCREASE = 30 // Speed increase per interval (units per second)
const SPEED_UPDATE_INTERVAL = 1000 // Update speed every 1000 points
const MAX_DELTA_TIME = 1 / 30 // Cap deltaTime to prevent physics issues at high refresh rates
const WRENCH_SCORE = 100
const WRENCH_SPAWN_CHANCE = 0.3
const WING_SPAWN_CHANCE = 0.2
const BOMB_SPAWN_CHANCE = 0.15
const BREAKABLE_PLATFORM_CHANCE = 0.4
const SCORE_RATE = 60 // Score points per second

// ===== GAME STATE =====
const gameState = {
  score: 0,
  gameOver: false,
  gameStarted: false,
  isPaused: false,
  lastFrameTime: 0,
  highScore: parseInt(localStorage.getItem('oilbertHighScore')) || 0,
  platformSpeed: INITIAL_PLATFORM_SPEED,
  lastSpeedUpdate: 0,
}

const playerState = {
  velocityY: 0,
  velocityX: 0,
  isJumping: false,
  canDoubleJump: 0,
  lastDoubleJumpCount: 0,
  hasDoubleJumped: false,
}

// ===== DOM ELEMENTS =====
const gameContainer = document.getElementById('game-container')
const player = document.getElementById('player')
const scoreElement = document.getElementById('score-container')
const highScoreElement = document.getElementById('high-score')
const speedElement = document.getElementById('speed')
const doubleJumpsElement = document.getElementById('double-jumps')
const splashScreen = document.getElementById('splash-screen')
const gameOverScreen = document.getElementById('game-over')
const pauseScreen = document.getElementById('pause-screen')

// ===== SOUND EFFECTS =====
const sounds = {
  jump: new Audio('Audio/CarJump.mp3'),
  collect: new Audio('Audio/CarCollect.mp3'),
  crash: new Audio('Audio/CarCrash.mp3'),
  spawn: new Audio('Audio/CarSpawn.mp3'),
}

// Adjust sound volumes
Object.values(sounds).forEach((sound) => (sound.volume = 0.3))
sounds.crash.volume = 0.4

// ===== GAME DATA =====
let platforms = []
const keys = {}
const keysPressed = {} // Track keys that were just pressed this frame

// ===== WINDOW RESIZE HANDLER =====
window.addEventListener('resize', () => {
  gameContainer.style.width = `${Math.min(800, window.innerWidth)}px`
  gameContainer.style.height = `${Math.min(400, window.innerHeight * 0.5)}px`
})

// ===== INPUT HANDLERS =====
document.addEventListener('keydown', (e) => {
  // Only set keysPressed if the key wasn't already down (prevents key repeat)
  if (!keys[e.code]) {
    keysPressed[e.code] = true
    
    // Handle pause (only on initial key press, not when held)
    if (e.code === 'Escape' && gameState.gameStarted && !gameState.gameOver) {
      togglePause()
    }
  }
  keys[e.code] = true
})

document.addEventListener('keyup', (e) => {
  keys[e.code] = false
})

// Touch controls
const touchButtons = {
  left: document.getElementById('left-button'),
  right: document.getElementById('right-button'),
  jump: document.getElementById('jump-button'),
}

Object.entries(touchButtons).forEach(([key, button]) => {
  button.addEventListener('touchstart', (e) => {
    e.preventDefault()
    if (key === 'jump') {
      if (!keys['Space']) keysPressed['Space'] = true
      keys['Space'] = true
    } else if (key === 'left') {
      keys['ArrowLeft'] = true
    } else if (key === 'right') {
      keys['ArrowRight'] = true
    }
  })

  button.addEventListener('touchend', (e) => {
    e.preventDefault()
    if (key === 'jump') keys['Space'] = false
    else if (key === 'left') keys['ArrowLeft'] = false
    else if (key === 'right') keys['ArrowRight'] = false
  })
})

// ===== UTILITY FUNCTIONS =====
function togglePause() {
  gameState.isPaused = !gameState.isPaused
  pauseScreen.style.display = gameState.isPaused ? 'flex' : 'none'
  
  // Reset timing when unpausing to prevent deltaTime spike
  if (!gameState.isPaused) {
    gameState.lastFrameTime = performance.now()
  }
}

function clearKeys() {
  Object.keys(keys).forEach(key => keys[key] = false)
}

function clearKeysPressed() {
  Object.keys(keysPressed).forEach(key => delete keysPressed[key])
}

function updateDisplay() {
  const currentScore = Math.floor(gameState.score / 10)
  scoreElement.textContent = `Score: ${currentScore}`
  highScoreElement.textContent = `High Score: ${gameState.highScore}`
  speedElement.textContent = `Speed: ${(
    gameState.platformSpeed / INITIAL_PLATFORM_SPEED
  ).toFixed(1)}x`

  // Only update double jump indicators if the count has changed
  if (playerState.lastDoubleJumpCount !== playerState.canDoubleJump) {
    doubleJumpsElement.innerHTML = ''
    for (let i = 0; i < playerState.canDoubleJump; i++) {
      const wing = document.createElement('img')
      wing.src = 'Sprites/WingPowerup.png'
      wing.className = 'wing-indicator'
      doubleJumpsElement.appendChild(wing)
    }
    playerState.lastDoubleJumpCount = playerState.canDoubleJump
  }
}

// ===== PLATFORM FUNCTIONS =====
function createPlatform(x, y, width, height, isBreakable = false) {
  const platform = document.createElement('div')
  platform.className = `platform${isBreakable ? ' breakable' : ''}`
  platform.style.left = `${x}px`
  platform.style.top = `${y}px`
  platform.style.width = `${width}px`
  platform.style.height = `${height}px`
  gameContainer.appendChild(platform)
  return platform
}

function createInitialPlatforms() {
  const containerHeight = gameContainer.offsetHeight
  return [
    createPlatform(0, containerHeight - 40, gameContainer.offsetWidth + 100, 40),
    createPlatform(400, containerHeight - 120, 200, 20),
    createPlatform(700, containerHeight - 200, 200, 20),
    createPlatform(1000, containerHeight - 150, 200, 20),
  ]
}

function movePlatforms(deltaTime) {
  const platformsToRemove = []
  
  document.querySelectorAll('.platform').forEach((platform) => {
    const currentX = parseFloat(platform.style.left)
    platform.style.left = `${currentX - gameState.platformSpeed * deltaTime}px`

    // Remove platforms that are off screen
    if (currentX + parseFloat(platform.style.width) < -200) {
      const index = platforms.indexOf(platform)
      if (index > -1) {
        platforms.splice(index, 1)
      }
      platformsToRemove.push(platform)
    }
  })
  
  platformsToRemove.forEach(p => p.remove())
}

function spawnNewPlatforms() {
  const lastPlatform = platforms[platforms.length - 1]
  if (!lastPlatform) return

  const containerRect = gameContainer.getBoundingClientRect()
  const lastX = parseFloat(lastPlatform.style.left)
  const lastWidth = parseFloat(lastPlatform.style.width)
  const viewDistance = containerRect.width * 4

  if (lastX + lastWidth < viewDistance) {
    const minGap = containerRect.width * 0.2
    const maxGap = containerRect.width * 0.4
    const gap = Math.random() * (maxGap - minGap) + minGap

    const platformY = containerRect.height - (Math.random() * 150 + 100)
    const isBreakable = Math.random() < BREAKABLE_PLATFORM_CHANCE
    const platformWidth =
      containerRect.width * 0.15 + Math.random() * (containerRect.width * 0.1)

    const newPlatform = createPlatform(
      lastX + lastWidth + gap,
      platformY,
      platformWidth,
      20,
      isBreakable
    )
    platforms.push(newPlatform)

    // Spawn powerups on the new platform
    spawnPowerupOnPlatform(lastX + lastWidth + gap, platformY, platformWidth, containerRect)
  }
}

// ===== POWERUP FUNCTIONS =====
function createPowerup(type, x, y) {
  const powerup = document.createElement('div')
  powerup.className = 'powerup'
  powerup.dataset.type = type
  powerup.style.left = `${x}px`
  powerup.style.top = `${y}px`

  const img = document.createElement('img')
  img.src = `Sprites/${type}.png`
  img.alt = type
  powerup.appendChild(img)

  gameContainer.appendChild(powerup)
  return powerup
}

function spawnPowerupOnPlatform(platformX, platformY, platformWidth, containerRect) {
  const powerupX = platformX + platformWidth / 2
  const powerupY = platformY - 40

  if (Math.random() < WRENCH_SPAWN_CHANCE) {
    createPowerup('Wrench', powerupX, powerupY)
  } else if (Math.random() < WING_SPAWN_CHANCE) {
    createPowerup('WingPowerup', powerupX, powerupY)
  } else if (
    Math.random() < BOMB_SPAWN_CHANCE &&
    platformWidth >= containerRect.width * 0.2
  ) {
    createPowerup('Bomb', powerupX, powerupY)
  }
}

function movePowerups(deltaTime) {
  const powerupsToRemove = []
  
  document.querySelectorAll('.powerup').forEach((powerup) => {
    const currentX = parseFloat(powerup.style.left)
    powerup.style.left = `${currentX - gameState.platformSpeed * deltaTime}px`

    // Remove powerups that are off screen
    if (currentX + 30 < -200) {
      powerupsToRemove.push(powerup)
    }
  })
  
  powerupsToRemove.forEach(p => p.remove())
}

function handlePowerupCollision(powerup, playerRect) {
  switch (powerup.dataset.type) {
    case 'Wrench':
      gameState.score += WRENCH_SCORE
      sounds.collect.play()
      break
    case 'WingPowerup':
      playerState.canDoubleJump++
      updateDisplay()
      sounds.spawn.play()
      break
    case 'Bomb':
      triggerGameOver()
      break
  }
  powerup.remove()
}

function checkPowerupCollisions(playerRect) {
  document.querySelectorAll('.powerup').forEach((powerup) => {
    const powerupRect = powerup.getBoundingClientRect()
    if (
      playerRect.right > powerupRect.left &&
      playerRect.left < powerupRect.right &&
      playerRect.bottom > powerupRect.top &&
      playerRect.top < powerupRect.bottom
    ) {
      handlePowerupCollision(powerup, playerRect)
    }
  })
}

// ===== COLLISION DETECTION =====
function checkPlatformCollisions(playerRect, containerRect, newY) {
  let onPlatform = false
  
  document.querySelectorAll('.platform').forEach((platform) => {
    if (platform.classList.contains('broken')) return

    const platformRect = platform.getBoundingClientRect()
    const playerBottom = playerRect.bottom - containerRect.top
    const platformTop = platformRect.top - containerRect.top
    const collisionBuffer = 10

    if (
      playerBottom >= platformTop - collisionBuffer &&
      playerBottom <= platformTop + collisionBuffer &&
      playerRect.right > platformRect.left + 5 &&
      playerRect.left < platformRect.right - 5 &&
      playerState.velocityY >= 0
    ) {
      onPlatform = true
      newY = platformTop - playerRect.height
      playerState.velocityY = 0
      playerState.isJumping = false
      playerState.hasDoubleJumped = false

      if (
        platform.classList.contains('breakable') &&
        !platform.classList.contains('decaying')
      ) {
        platform.classList.add('decaying')
        setTimeout(() => {
          if (platform && platform.parentNode) {
            platform.classList.add('broken')
          }
        }, 1000)
        sounds.crash.play()
      }
    }
  })
  
  return { onPlatform, newY }
}

// ===== PLAYER MOVEMENT =====
function handlePlayerMovement(deltaTime) {
  if (keys['ArrowLeft'] || keys['KeyA']) {
    playerState.velocityX = -PLAYER_SPEED * deltaTime
    player.querySelector('img').style.transform = 'scaleX(-1)'
  } else if (keys['ArrowRight'] || keys['KeyD']) {
    playerState.velocityX = PLAYER_SPEED * deltaTime
    player.querySelector('img').style.transform = 'scaleX(1)'
  } else {
    playerState.velocityX = 0
  }
}

function updatePlayerPosition(deltaTime) {
  const playerRect = player.getBoundingClientRect()
  const containerRect = gameContainer.getBoundingClientRect()

  // Update horizontal position
  let newX =
    playerRect.left -
    containerRect.left +
    playerState.velocityX -
    gameState.platformSpeed * deltaTime
  newX = Math.max(0, Math.min(newX, containerRect.width - playerRect.width))
  player.style.left = `${newX}px`

  // Update vertical position with gravity
  playerState.velocityY += GRAVITY * deltaTime
  let currentY = parseInt(player.style.top || '0')
  let newY = currentY + playerState.velocityY * deltaTime

  return { playerRect, containerRect, newY }
}

function handleJumping(onPlatform) {
  const jumpKeyPressed = keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']
  
  if (jumpKeyPressed) {
    if (!playerState.isJumping && onPlatform) {
      // Initial jump from platform
      playerState.velocityY = JUMP_FORCE
      playerState.isJumping = true
      playerState.hasDoubleJumped = false
      player.classList.add('jumping')
      setTimeout(() => player.classList.remove('jumping'), 500)
      sounds.jump.play()
    } else if (playerState.canDoubleJump > 0 && !playerState.hasDoubleJumped && !onPlatform) {
      // Double jump in air
      playerState.velocityY = JUMP_FORCE
      playerState.canDoubleJump--
      playerState.hasDoubleJumped = true
      player.classList.add('jumping')
      setTimeout(() => player.classList.remove('jumping'), 500)
      sounds.jump.play()
    }
  }
}

// ===== GAME OVER =====
function triggerGameOver() {
  if (gameState.gameOver) return
  
  gameState.gameOver = true
  sounds.crash.play()
  gameOverScreen.style.display = 'flex'
  
  const finalScore = Math.floor(gameState.score / 10)
  document.getElementById('final-score').textContent = `Score: ${finalScore}`

  const isNewRecord = finalScore > gameState.highScore
  if (isNewRecord) {
    gameState.highScore = finalScore
    localStorage.setItem('oilbertHighScore', gameState.highScore)
  }

  const highScoreElement = document.getElementById('final-high-score')
  highScoreElement.textContent = `High Score: ${gameState.highScore}`
  highScoreElement.classList.toggle('new-record', isNewRecord)
}

function checkGameOver(newY, containerRect) {
  if (newY + player.getBoundingClientRect().height > containerRect.height) {
    triggerGameOver()
  }
}

// ===== GAME RESET =====
function resetGame() {
  const finalScore = Math.floor(gameState.score / 10)
  if (finalScore > gameState.highScore) {
    gameState.highScore = finalScore
    localStorage.setItem('oilbertHighScore', gameState.highScore)
  }

  // Reset game state
  gameState.score = 0
  gameState.gameOver = false
  gameState.gameStarted = false
  gameState.isPaused = false
  gameState.platformSpeed = INITIAL_PLATFORM_SPEED
  gameState.lastSpeedUpdate = 0

  // Reset player state
  playerState.velocityY = 0
  playerState.velocityX = 0
  playerState.isJumping = false
  playerState.canDoubleJump = 0
  playerState.lastDoubleJumpCount = 0
  playerState.hasDoubleJumped = false

  // Clear all key states to prevent stuck keys
  clearKeys()

  // Clear existing platforms and powerups
  document.querySelectorAll('.platform, .powerup').forEach((el) => el.remove())

  // Create new platforms
  platforms = createInitialPlatforms()

  // Reset player position
  const containerHeight = gameContainer.offsetHeight
  player.style.top = `${containerHeight - 90}px`
  player.style.left = '100px'

  // Update display
  updateDisplay()

  // Show splash screen
  splashScreen.style.display = 'flex'
  gameOverScreen.style.display = 'none'
  pauseScreen.style.display = 'none'
}

// ===== GAME LOOP =====
function gameLoop(currentTime) {
  // Initialize lastFrameTime on first frame
  if (!gameState.lastFrameTime) {
    gameState.lastFrameTime = currentTime
  }

  // Calculate time since last frame in seconds, capped to prevent physics issues
  const deltaTime = Math.min(
    (currentTime - gameState.lastFrameTime) / 1000,
    MAX_DELTA_TIME
  )
  gameState.lastFrameTime = currentTime

  // Handle game states
  if (!gameState.gameStarted) {
    if (keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']) {
      gameState.gameStarted = true
      splashScreen.style.display = 'none'
      sounds.spawn.play()
      gameState.lastSpeedUpdate = gameState.score
      gameState.platformSpeed = INITIAL_PLATFORM_SPEED
    }
    clearKeysPressed()
    requestAnimationFrame(gameLoop)
    return
  }

  if (gameState.gameOver) {
    if (keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']) {
      resetGame()
      gameState.gameStarted = true
      splashScreen.style.display = 'none'
      gameOverScreen.style.display = 'none'
      sounds.spawn.play()
      gameState.lastSpeedUpdate = gameState.score
      gameState.platformSpeed = INITIAL_PLATFORM_SPEED
    }
    clearKeysPressed()
    requestAnimationFrame(gameLoop)
    return
  }

  if (gameState.isPaused) {
    // Keep lastFrameTime updated while paused to prevent deltaTime spike
    gameState.lastFrameTime = currentTime
    clearKeysPressed()
    requestAnimationFrame(gameLoop)
    return
  }

  // Update platform speed every SPEED_UPDATE_INTERVAL points
  if (gameState.score - gameState.lastSpeedUpdate >= SPEED_UPDATE_INTERVAL) {
    gameState.platformSpeed += SPEED_INCREASE
    gameState.lastSpeedUpdate = gameState.score
    updateDisplay()
  }

  // Handle player movement
  handlePlayerMovement(deltaTime)

  // Update player position
  const { playerRect, containerRect, newY: calculatedY } = updatePlayerPosition(deltaTime)
  
  // Move platforms and powerups
  movePlatforms(deltaTime)
  movePowerups(deltaTime)

  // Check powerup collisions
  checkPowerupCollisions(playerRect)

  // Spawn new platforms
  spawnNewPlatforms()

  // Check platform collisions
  const { onPlatform, newY } = checkPlatformCollisions(playerRect, containerRect, calculatedY)

  // Handle jumping
  handleJumping(onPlatform)

  // Update player vertical position
  player.style.top = `${newY}px`

  // Check for game over
  checkGameOver(newY, containerRect)

  // Update score based on time
  if (!gameState.gameOver) {
    gameState.score += SCORE_RATE * deltaTime
    updateDisplay()
  }

  // Clear keys pressed this frame
  clearKeysPressed()

  requestAnimationFrame(gameLoop)
}

// ===== START GAME =====
resetGame()
gameState.lastFrameTime = performance.now()
gameLoop(gameState.lastFrameTime)
