// Game variables
let score = 0
let gameOver = false
let gameStarted = false
let highScore = parseInt(localStorage.getItem('oilbertHighScore')) || 0
let platformSpeed = 5
let playerVelocityY = 0
let playerVelocityX = 0
let isJumping = false
let canDoubleJump = 0
let hasDoubleJumped = false

// Constants
const GRAVITY = 0.5
const JUMP_FORCE = -12
const PLAYER_SPEED = 10
const INITIAL_PLATFORM_SPEED = 3
const SPEED_INCREASE = 0.0005
const WRENCH_SCORE = 100
const WRENCH_SPAWN_CHANCE = 0.3
const WING_SPAWN_CHANCE = 0.1
const BOMB_SPAWN_CHANCE = 0.15
const BREAKABLE_PLATFORM_CHANCE = 0.4
const BOMB_BASE_SIZE = 30
const BOMB_SCALE_FACTOR = 0.0005
const PLATFORM_SPAWN_DISTANCE = window.innerWidth * 4 // Spawn platforms 4 screens ahead
const INITIAL_PLATFORM_DISTANCE = window.innerWidth * 3 // Initial platforms span 3 screens

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
  powerup.appendChild(img)

  gameContainer.appendChild(powerup)
  return powerup
}

// Handle keyboard input
const keys = {}
document.addEventListener('keydown', (e) => (keys[e.code] = true))
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
  platformSpeed = INITIAL_PLATFORM_SPEED
  playerVelocityY = 0
  playerVelocityX = 0
  isJumping = false
  canDoubleJump = 0
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
}

// Update game display
function updateDisplay() {
  const currentScore = Math.floor(score / 10)
  scoreElement.textContent = `Score: ${currentScore}`
  highScoreElement.textContent = `High Score: ${highScore}`
  speedElement.textContent = `Speed: ${platformSpeed.toFixed(1)}x`

  // Update double jump indicators
  doubleJumpsElement.innerHTML = ''
  for (let i = 0; i < canDoubleJump; i++) {
    const wing = document.createElement('img')
    wing.src = 'Sprites/WingPowerup.png'
    wing.className = 'wing-indicator'
    doubleJumpsElement.appendChild(wing)
  }
}

// Game loop
function gameLoop() {
  if (!gameStarted) {
    if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
      gameStarted = true
      splashScreen.style.display = 'none'
      sounds.spawn.play()
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
    }
    requestAnimationFrame(gameLoop)
    return
  }

  // Update platform speed
  platformSpeed += SPEED_INCREASE

  // Handle player movement
  if (keys['ArrowLeft'] || keys['KeyA']) {
    playerVelocityX = -PLAYER_SPEED
  } else if (keys['ArrowRight'] || keys['KeyD']) {
    playerVelocityX = PLAYER_SPEED
  } else {
    playerVelocityX = 0
  }

  // Update player position
  const playerRect = player.getBoundingClientRect()
  const containerRect = gameContainer.getBoundingClientRect()

  // Adjust player position to account for platform movement
  let newX =
    playerRect.left - containerRect.left + playerVelocityX - platformSpeed
  newX = Math.max(0, Math.min(newX, containerRect.width - playerRect.width))
  player.style.left = `${newX}px`

  // Apply gravity
  playerVelocityY += GRAVITY
  let currentY = parseInt(player.style.top || '0')
  let newY = currentY + playerVelocityY

  // Move platforms and check for removal
  document.querySelectorAll('.platform').forEach((platform) => {
    const currentX = parseFloat(platform.style.left)
    platform.style.left = `${currentX - platformSpeed}px`

    // Remove platforms that are off screen
    if (currentX + parseFloat(platform.style.width) < -200) {
      platform.remove()
    }
  })

  // Check if we need to spawn new platforms
  const lastPlatform = document.querySelector('.platform:last-child')
  if (lastPlatform) {
    const lastX = parseFloat(lastPlatform.style.left)
    const lastWidth = parseFloat(lastPlatform.style.width)
    const containerWidth = gameContainer.offsetWidth
    const viewDistance = containerWidth * 4 // How far ahead we want to maintain platforms

    if (lastX + lastWidth < viewDistance) {
      const minGap = containerWidth * 0.2 // 20% of screen width
      const maxGap = containerWidth * 0.4 // 40% of screen width
      const gap = Math.random() * (maxGap - minGap) + minGap

      // Ensure platform height is reachable and scales with container height
      const containerHeight = gameContainer.offsetHeight
      const minHeight = Math.min(
        containerHeight - containerHeight * 0.25, // 75% of height
        lastPlatform.offsetTop + containerHeight * 0.25 // 25% higher than last
      )
      const maxHeight = Math.max(
        containerHeight - containerHeight * 0.625, // 37.5% of height
        lastPlatform.offsetTop - containerHeight * 0.25 // 25% lower than last
      )
      const platformY = Math.min(
        maxHeight,
        Math.max(
          minHeight,
          containerHeight -
            (Math.random() * (containerHeight * 0.375) + containerHeight * 0.25)
        )
      )

      const isBreakable = Math.random() < BREAKABLE_PLATFORM_CHANCE
      const newPlatform = createPlatform(
        lastX + lastWidth + gap,
        platformY,
        containerWidth * 0.125 + Math.random() * (containerWidth * 0.125), // 12.5-25% of screen width
        20,
        isBreakable
      )

      // Add to platforms array for tracking
      platforms.push(newPlatform)

      // Get platform width for powerup spawn logic
      const platformWidth = parseFloat(newPlatform.style.width)
      const isBigPlatform = platformWidth >= containerWidth * 0.2 // Platform is at least 20% of screen width

      // Spawn powerups
      if (Math.random() < WRENCH_SPAWN_CHANCE) {
        createPowerup(
          'Wrench',
          parseFloat(newPlatform.style.left) +
            parseFloat(newPlatform.style.width) / 2,
          parseFloat(newPlatform.style.top) - 50
        )
      } else if (Math.random() < WING_SPAWN_CHANCE) {
        createPowerup(
          'WingPowerup',
          parseFloat(newPlatform.style.left) +
            parseFloat(newPlatform.style.width) / 2,
          parseFloat(newPlatform.style.top) - 60
        )
      } else if (Math.random() < BOMB_SPAWN_CHANCE && isBigPlatform) {
        // Only spawn bombs on big platforms
        createPowerup(
          'Bomb',
          parseFloat(newPlatform.style.left) +
            parseFloat(newPlatform.style.width) / 2,
          parseFloat(newPlatform.style.top) - 55
        )
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

  // Move and check powerups
  document.querySelectorAll('.powerup').forEach((powerup) => {
    const currentX = parseFloat(powerup.style.left)
    powerup.style.left = `${currentX - platformSpeed}px`

    if (currentX + 30 < 0) {
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

            // Check if this is a new high score
            if (finalScore > highScore) {
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

  // Update score if game is still running
  if (!gameOver) {
    score++
    updateDisplay()
  }

  requestAnimationFrame(gameLoop)
}

// Start game
resetGame()
gameLoop()
