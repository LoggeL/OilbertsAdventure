// Constants
const GRAVITY = 0.5
const JUMP_FORCE = -12
const PLAYER_SPEED = 10
const INITIAL_PLATFORM_SPEED = 3
const SPEED_INCREASE = 0.5 // Increased for more noticeable acceleration
const SPEED_UPDATE_INTERVAL = 1000 // Update speed every 1000 points
const WRENCH_SCORE = 100
const WRENCH_SPAWN_CHANCE = 0.3
const WING_SPAWN_CHANCE = 0.2
const BOMB_SPAWN_CHANCE = 0.15
const BREAKABLE_PLATFORM_CHANCE = 0.4
const BOMB_BASE_SIZE = 30
const BOMB_SCALE_FACTOR = 0.0005
const PLATFORM_SPAWN_DISTANCE = window.innerWidth * 4
const INITIAL_PLATFORM_DISTANCE = window.innerWidth * 3 // Initial platforms span 3 screens

// Game variables
let score = 0
let gameOver = false
let gameStarted = false
let isPaused = false
let lastFrameTime = 0
let highScore = parseInt(localStorage.getItem('oilbertHighScore')) || 0
let platformSpeed = INITIAL_PLATFORM_SPEED
let playerVelocityY = 0
let playerVelocityX = 0
let isJumping = false
let canDoubleJump = 0
let lastDoubleJumpCount = 0
let hasDoubleJumped = false
let lastSpeedUpdate = 0

// Update game container size on window resize
window.addEventListener('resize', () => {
  const gameContainer = document.getElementById('game-container')
  gameContainer.style.width = `${Math.min(800, window.innerWidth)}px`
  gameContainer.style.height = `${Math.min(400, window.innerHeight * 0.5)}px`
})

// Sound effects
const sounds = {
  jump: new Audio('Audio/CarJump.mp3'),
  collect: new Audio('Audio/CarCollect.mp3'),
  crash: new Audio('Audio/CarCrash.mp3'),
  spawn: new Audio('Audio/CarSpawn.mp3'),
}

// Adjust sound volumes
Object.values(sounds).forEach((sound) => (sound.volume = 0.3))
sounds.crash.volume = 0.4

// Get DOM elements
const gameContainer = document.getElementById('game-container')
const player = document.getElementById('player')
const scoreElement = document.getElementById('score-container')
const highScoreElement = document.getElementById('high-score')
const speedElement = document.getElementById('speed')
const doubleJumpsElement = document.getElementById('double-jumps')
const splashScreen = document.getElementById('splash-screen')
const gameOverScreen = document.getElementById('game-over')
const pauseScreen = document.getElementById('pause-screen')

// Platform tracking
let platforms = []

// Create initial platforms
function createInitialPlatforms() {
  const containerWidth = gameContainer.offsetWidth
  const containerHeight = gameContainer.offsetHeight
  const platformCount = Math.ceil(INITIAL_PLATFORM_DISTANCE / 200) // More frequent initial platforms

  const platforms = [
    createPlatform(0, containerHeight - 40, containerWidth + 200, 40),
  ]

  let lastX = containerWidth
  for (let i = 1; i < platformCount; i++) {
    const gap = Math.random() * 150 + 150 // Gap between 150-300
    const width = Math.random() * 100 + 150 // Width between 150-250
    const height = 20
    const y = containerHeight - (Math.random() * 150 + 50) // Height variation

    platforms.push(createPlatform(lastX + gap, y, width, height))
    lastX += gap + width
  }

  return platforms
}

// Create a platform element
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

// Create a powerup element
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

// Handle keyboard input
const keys = {}
document.addEventListener('keydown', (e) => {
  keys[e.code] = true

  // Handle pause
  if (e.code === 'Escape' && gameStarted && !gameOver) {
    isPaused = !isPaused
    pauseScreen.style.display = isPaused ? 'flex' : 'none'

    if (!isPaused) {
      // Reset last frame time when unpausing
      lastFrameTime = performance.now()
      // Resume game loop
      requestAnimationFrame(gameLoop)
    }
  }
})
document.addEventListener('keyup', (e) => (keys[e.code] = false))

// Handle touch controls
const touchButtons = {
  left: document.getElementById('left-button'),
  right: document.getElementById('right-button'),
  jump: document.getElementById('jump-button'),
}

Object.entries(touchButtons).forEach(([key, button]) => {
  button.addEventListener('touchstart', () => {
    if (key === 'jump') keys['Space'] = true
    else if (key === 'left') keys['ArrowLeft'] = true
    else if (key === 'right') keys['ArrowRight'] = true
  })

  button.addEventListener('touchend', () => {
    if (key === 'jump') keys['Space'] = false
    else if (key === 'left') keys['ArrowLeft'] = false
    else if (key === 'right') keys['ArrowRight'] = false
  })
})

// Reset game
function resetGame() {
  const finalScore = Math.floor(score / 10)
  if (finalScore > highScore) {
    highScore = finalScore
    localStorage.setItem('oilbertHighScore', highScore)
  }

  // Reset variables
  score = 0
  gameOver = false
  gameStarted = false
  isPaused = false
  platformSpeed = INITIAL_PLATFORM_SPEED
  playerVelocityY = 0
  playerVelocityX = 0
  isJumping = false
  canDoubleJump = 0
  lastDoubleJumpCount = 0
  hasDoubleJumped = false

  // Clear existing platforms and powerups
  document.querySelectorAll('.platform, .powerup').forEach((el) => el.remove())

  // Create new platforms
  const containerHeight = gameContainer.offsetHeight
  platforms = [
    createPlatform(
      0,
      containerHeight - 40,
      gameContainer.offsetWidth + 100,
      40
    ),
    createPlatform(400, containerHeight - 120, 200, 20),
    createPlatform(700, containerHeight - 200, 200, 20),
    createPlatform(1000, containerHeight - 150, 200, 20),
  ]

  // Reset player position - place just above the ground platform
  player.style.top = `${containerHeight - 90}px`
  player.style.left = '100px'

  // Update display
  updateDisplay()

  // Show splash screen
  splashScreen.style.display = 'flex'
  gameOverScreen.style.display = 'none'
  pauseScreen.style.display = 'none'
}

// Update game display
function updateDisplay() {
  const currentScore = Math.floor(score / 10)
  scoreElement.textContent = `Score: ${currentScore}`
  highScoreElement.textContent = `High Score: ${highScore}`
  speedElement.textContent = `Speed: ${platformSpeed.toFixed(1)}x`

  // Only update double jump indicators if the count has changed
  if (lastDoubleJumpCount !== canDoubleJump) {
    doubleJumpsElement.innerHTML = ''
    for (let i = 0; i < canDoubleJump; i++) {
      const wing = document.createElement('img')
      wing.src = 'Sprites/WingPowerup.png'
      wing.className = 'wing-indicator'
      doubleJumpsElement.appendChild(wing)
    }
    lastDoubleJumpCount = canDoubleJump
  }
}

// Game loop
function gameLoop(currentTime) {
  // Initialize lastFrameTime on first frame
  if (!lastFrameTime) {
    lastFrameTime = currentTime
  }

  // Calculate time since last frame in seconds
  const deltaTime = (currentTime - lastFrameTime) / 1000
  lastFrameTime = currentTime

  if (!gameStarted) {
    if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
      gameStarted = true
      splashScreen.style.display = 'none'
      sounds.spawn.play()
      lastSpeedUpdate = score
      platformSpeed = INITIAL_PLATFORM_SPEED
    }
    requestAnimationFrame(gameLoop)
    return
  }

  if (gameOver) {
    if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
      resetGame()
      gameStarted = true
      splashScreen.style.display = 'none'
      gameOverScreen.style.display = 'none'
      sounds.spawn.play()
      lastSpeedUpdate = score
      platformSpeed = INITIAL_PLATFORM_SPEED
    }
    requestAnimationFrame(gameLoop)
    return
  }

  if (isPaused) {
    // Reset lastFrameTime when paused to prevent time accumulation
    lastFrameTime = currentTime
    requestAnimationFrame(gameLoop)
    return
  }

  // Update platform speed every SPEED_UPDATE_INTERVAL points
  if (!gameOver && score - lastSpeedUpdate >= SPEED_UPDATE_INTERVAL) {
    platformSpeed += SPEED_INCREASE
    lastSpeedUpdate = score
    speedElement.textContent = `Speed: ${platformSpeed.toFixed(1)}x`
  }

  // Handle player movement
  if (keys['ArrowLeft'] || keys['KeyA']) {
    playerVelocityX = -PLAYER_SPEED
  } else if (keys['ArrowRight'] || keys['KeyD']) {
    playerVelocityX = PLAYER_SPEED
  } else {
    playerVelocityX = 0
  }

  // Update player position with deltaTime
  const playerRect = player.getBoundingClientRect()
  const containerRect = gameContainer.getBoundingClientRect()

  // Adjust player position to account for platform movement
  let newX =
    playerRect.left -
    containerRect.left +
    (playerVelocityX - platformSpeed) * deltaTime * 60
  newX = Math.max(0, Math.min(newX, containerRect.width - playerRect.width))
  player.style.left = `${newX}px`

  // Apply gravity with deltaTime
  playerVelocityY += GRAVITY * deltaTime * 60
  let currentY = parseInt(player.style.top || '0')
  let newY = currentY + playerVelocityY * deltaTime * 60

  // Move platforms and check for removal
  document.querySelectorAll('.platform').forEach((platform) => {
    const currentX = parseFloat(platform.style.left)
    platform.style.left = `${currentX - platformSpeed * deltaTime * 60}px`

    // Remove platforms that are off screen
    if (currentX + parseFloat(platform.style.width) < -200) {
      const index = platforms.indexOf(platform)
      if (index > -1) {
        platforms.splice(index, 1)
      }
      platform.remove()
    }
  })

  // Move powerups with platforms
  document.querySelectorAll('.powerup').forEach((powerup) => {
    const currentX = parseFloat(powerup.style.left)
    powerup.style.left = `${currentX - platformSpeed * deltaTime * 60}px`

    // Remove powerups that are off screen
    if (currentX + 30 < -200) {
      powerup.remove()
      return
    }

    const powerupRect = powerup.getBoundingClientRect()
    if (
      playerRect.right > powerupRect.left &&
      playerRect.left < powerupRect.right &&
      playerRect.bottom > powerupRect.top &&
      playerRect.top < powerupRect.bottom
    ) {
      switch (powerup.dataset.type) {
        case 'Wrench':
          score += WRENCH_SCORE
          sounds.collect.play()
          break
        case 'WingPowerup':
          canDoubleJump++
          updateDisplay()
          sounds.spawn.play()
          break
        case 'Bomb':
          if (!gameOver) {
            gameOver = true
            sounds.crash.play()
            gameOverScreen.style.display = 'flex'
            const finalScore = Math.floor(score / 10)
            document.getElementById(
              'final-score'
            ).textContent = `Score: ${finalScore}`
            const highScoreElement = document.getElementById('final-high-score')
            highScoreElement.textContent = `High Score: ${highScore}`

            if (finalScore > highScore) {
              highScore = finalScore
              localStorage.setItem('oilbertHighScore', highScore)
              highScoreElement.classList.add('new-record')
            } else {
              highScoreElement.classList.remove('new-record')
            }
          }
          break
      }
      powerup.remove()
    }
  })

  // Spawn new platforms
  const lastPlatform = platforms[platforms.length - 1]
  if (lastPlatform) {
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
      const powerupX = lastX + lastWidth + gap + platformWidth / 2
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
  }

  // Check platform collisions
  let onPlatform = false
  document.querySelectorAll('.platform').forEach((platform) => {
    if (platform.classList.contains('broken')) return

    const platformRect = platform.getBoundingClientRect()
    const playerBottom = playerRect.bottom - containerRect.top
    const platformTop = platformRect.top - containerRect.top

    // Expand collision check slightly
    const collisionBuffer = 10

    if (
      playerBottom >= platformTop - collisionBuffer &&
      playerBottom <= platformTop + collisionBuffer &&
      playerRect.right > platformRect.left + 5 && // Add slight inset to prevent edge cases
      playerRect.left < platformRect.right - 5 &&
      playerVelocityY >= 0
    ) {
      onPlatform = true
      newY = platformTop - playerRect.height
      playerVelocityY = 0
      isJumping = false

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

  // Handle jumping
  if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
    if (!isJumping && onPlatform) {
      playerVelocityY = JUMP_FORCE
      isJumping = true
      player.classList.add('jumping')
      setTimeout(() => player.classList.remove('jumping'), 500)
      sounds.jump.play()
    } else if (canDoubleJump > 0 && playerVelocityY > 0) {
      playerVelocityY = JUMP_FORCE
      canDoubleJump--
      player.classList.add('jumping')
      setTimeout(() => player.classList.remove('jumping'), 500)
      sounds.jump.play()
    }
  }

  // Update player vertical position
  player.style.top = `${newY}px`

  // Check for game over
  if (newY + playerRect.height > containerRect.height) {
    if (!gameOver) {
      gameOver = true
      sounds.crash.play()
      gameOverScreen.style.display = 'flex'
      const finalScore = Math.floor(score / 10)
      document.getElementById(
        'final-score'
      ).textContent = `Score: ${finalScore}`
      const highScoreElement = document.getElementById('final-high-score')
      highScoreElement.textContent = `High Score: ${highScore}`

      // Check if this is a new high score
      if (finalScore > highScore) {
        highScoreElement.classList.add('new-record')
      } else {
        highScoreElement.classList.remove('new-record')
      }
    }
  }

  // Update score if game is still running
  if (!gameOver) {
    score += deltaTime * 60 // Scale score increase with deltaTime
    updateDisplay()
  }

  requestAnimationFrame(gameLoop)
}

// Start game
resetGame()
lastFrameTime = performance.now()
gameLoop(lastFrameTime)
