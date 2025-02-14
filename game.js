const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

// Set canvas size
canvas.width = 800
canvas.height = 400

// Game variables
let score = 0
let gameOver = false
let gameStarted = false // New variable to track if game has started
let highScore = parseInt(localStorage.getItem('oilbertHighScore')) || 0 // Add highscore tracking
const gravity = 0.5
const jumpForce = -12
let platformSpeed = 3
let rotation = 0
const playerSpeed = 5
const speedIncreaseFactor = 0.001 // Doubled acceleration
const WRENCH_SCORE = 100
const WRENCH_SPAWN_CHANCE = 0.3
const WING_SPAWN_CHANCE = 0.1
const BOMB_SPAWN_CHANCE = 0.15
const BREAKABLE_PLATFORM_CHANCE = 0.4 // 40% chance for breakable platforms
const BOMB_BASE_SIZE = 30
const BOMB_SCALE_FACTOR = 0.0005 // How much to grow per score point

// Sound effects
const sounds = {
  jump: new Audio('Sounds/CarJump.mp3'),
  collect: new Audio('Sounds/CarCollect.mp3'),
  crash: new Audio('Sounds/CarCrash.mp3'),
  spawn: new Audio('Sounds/CarSpawn.mp3'),
}

// Adjust sound volumes
sounds.jump.volume = 0.3
sounds.collect.volume = 0.3
sounds.crash.volume = 0.4
sounds.spawn.volume = 0.2

// Function to play sound with restart
function playSound(sound) {
  sound.currentTime = 0
  sound.play().catch((error) => console.log('Error playing sound:', error))
}

// Player object
const player = {
  x: 100,
  y: canvas.height,
  width: 75,
  height: 50,
  velocityY: 0,
  velocityX: 0,
  isJumping: false,
  isFlipping: false,
  canDoubleJump: 0, // Changed to number for stacking
  hasDoubleJumped: false,
  image: new Image(),
}
player.image.src = 'Sprites/Oilbert.png'

// Platform class
class Platform {
  constructor(x, y, width, height, isBreakable = false) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.isBreakable = isBreakable
    this.broken = false
    this.decaying = false
    this.decayStartTime = 0
    this.decayDuration = 250 // 0.25 second in milliseconds
  }

  draw() {
    if (this.broken) return

    if (this.decaying) {
      const currentTime = Date.now()
      const elapsedTime = currentTime - this.decayStartTime
      const progress = elapsedTime / this.decayDuration

      if (progress >= 1) {
        this.broken = true
        return
      }

      // Make platform more transparent as it decays
      ctx.globalAlpha = 1 - progress
    }

    ctx.fillStyle = this.isBreakable ? '#FFA500' : '#4CAF50'
    ctx.fillRect(this.x, this.y, this.width, this.height)
    if (this.isBreakable) {
      ctx.strokeStyle = '#FF4500'
      ctx.lineWidth = 2
      ctx.strokeRect(this.x, this.y, this.width, this.height)
    }

    // Reset global alpha
    if (this.decaying) {
      ctx.globalAlpha = 1
    }
  }

  startDecay() {
    if (this.isBreakable && !this.decaying) {
      this.decaying = true
      this.decayStartTime = Date.now()
    }
  }
}

// Powerup classes
class Wrench {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.width = 30
    this.height = 30
    this.image = new Image()
    this.image.src = 'Sprites/Wrench.png'
  }

  draw() {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height)
  }
}

class Wing {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.width = 40
    this.height = 40
    this.image = new Image()
    this.image.src = 'Sprites/WingPowerup.png'
  }

  draw() {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height)
  }
}

class Bomb {
  constructor(x, y) {
    this.x = x
    this.y = y
    this.baseWidth = BOMB_BASE_SIZE
    this.baseHeight = BOMB_BASE_SIZE
    this.image = new Image()
    this.image.src = 'Sprites/Bomb.png'
  }

  draw() {
    // Calculate current size based on score
    const scaleFactor = 1 + Math.floor(score / 10) * BOMB_SCALE_FACTOR
    this.width = this.baseWidth * scaleFactor
    this.height = this.baseHeight * scaleFactor

    // Center the bomb as it grows
    const xOffset = (this.width - this.baseWidth) / 2
    const yOffset = (this.height - this.baseHeight) / 2

    ctx.drawImage(
      this.image,
      this.x - xOffset,
      this.y - yOffset,
      this.width,
      this.height
    )
  }
}

// Create initial platforms
let platforms = [
  new Platform(0, canvas.height - 40, canvas.width + 100, 40),
  new Platform(400, canvas.height - 120, 200, 20),
  new Platform(700, canvas.height - 200, 200, 20),
  new Platform(1000, canvas.height - 150, 200, 20),
]

// Create arrays for powerups
let wrenches = []
let wings = []
let bombs = []

// Handle keyboard input
const keys = {}
document.addEventListener('keydown', (e) => {
  keys[e.code] = true
})
document.addEventListener('keyup', (e) => {
  keys[e.code] = false
})

// Mobile touch controls
let touchStartX = 0
let isTouching = false
let isJumpPressed = false

// Create touch zones
const leftTouchZone = canvas.width * 0.3 // 30% of screen width for left movement
const rightTouchZone = canvas.width * 0.7 // 70% of screen width starts right movement
const jumpZone = canvas.height * 0.5 // Top half of screen for jumping

// Handle touch controls
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault() // Prevent scrolling
  const touch = e.touches[0]
  const rect = canvas.getBoundingClientRect()
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  touchStartX = x
  isTouching = true

  // Check if touch is in jump zone (top half of screen)
  if (y < jumpZone) {
    isJumpPressed = true
    keys['Space'] = true
  }
})

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault() // Prevent scrolling
  if (!isTouching) return

  const touch = e.touches[0]
  const rect = canvas.getBoundingClientRect()
  const x = touch.clientX - rect.left

  // Reset movement keys
  keys['ArrowLeft'] = false
  keys['ArrowRight'] = false

  // Check horizontal position for movement
  if (x < leftTouchZone) {
    keys['ArrowLeft'] = true
  } else if (x > rightTouchZone) {
    keys['ArrowRight'] = true
  }
})

canvas.addEventListener('touchend', (e) => {
  e.preventDefault() // Prevent scrolling
  isTouching = false
  isJumpPressed = false
  // Reset all controls
  keys['ArrowLeft'] = false
  keys['ArrowRight'] = false
  keys['Space'] = false
})

// Add visual indicators for touch controls during gameplay
function drawTouchControls() {
  if (!gameStarted || gameOver) return

  ctx.save()
  ctx.globalAlpha = 0.2

  // Draw left arrow
  ctx.fillStyle = keys['ArrowLeft'] ? '#FFD700' : 'white'
  ctx.beginPath()
  ctx.moveTo(80, canvas.height - 60)
  ctx.lineTo(40, canvas.height - 40)
  ctx.lineTo(80, canvas.height - 20)
  ctx.closePath()
  ctx.fill()

  // Draw right arrow
  ctx.fillStyle = keys['ArrowRight'] ? '#FFD700' : 'white'
  ctx.beginPath()
  ctx.moveTo(canvas.width - 80, canvas.height - 60)
  ctx.lineTo(canvas.width - 40, canvas.height - 40)
  ctx.lineTo(canvas.width - 80, canvas.height - 20)
  ctx.closePath()
  ctx.fill()

  // Draw jump indicator
  ctx.fillStyle = isJumpPressed ? '#FFD700' : 'white'
  ctx.beginPath()
  ctx.moveTo(canvas.width / 2 - 20, canvas.height - 60)
  ctx.lineTo(canvas.width / 2 + 20, canvas.height - 60)
  ctx.lineTo(canvas.width / 2, canvas.height - 20)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// Reset game function
function resetGame() {
  // Update high score before resetting
  const finalScore = Math.floor(score / 10)
  if (finalScore > highScore) {
    highScore = finalScore
    localStorage.setItem('oilbertHighScore', highScore)
  }

  score = 0
  gameOver = false
  gameStarted = false // Reset to show splash screen
  platformSpeed = 3
  player.x = 100
  player.y = canvas.height - player.height
  player.velocityY = 0
  player.velocityX = 0
  player.isJumping = false
  player.isFlipping = false
  player.canDoubleJump = 0
  player.hasDoubleJumped = false
  rotation = 0
  wrenches = []
  wings = []
  bombs = []

  // Reset platforms
  platforms = [
    new Platform(0, canvas.height - 40, canvas.width + 100, 40),
    new Platform(400, canvas.height - 120, 200, 20),
    new Platform(700, canvas.height - 200, 200, 20),
    new Platform(1000, canvas.height - 150, 200, 20),
  ]
}

// Draw splash screen
function drawSplashScreen() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw title
  ctx.fillStyle = 'white'
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.fillText("Oilbert's Adventure", canvas.width / 2, 80)

  // Draw high score under title if it exists
  if (highScore > 0) {
    ctx.font = 'bold 24px Arial'
    ctx.fillText(`High Score: ${highScore}`, canvas.width / 2, 120)
  }

  // Draw Oilbert
  ctx.save()
  ctx.translate(canvas.width / 2 - player.width / 2, 100)
  ctx.drawImage(player.image, 0, 0, player.width * 1.5, player.height * 1.5)
  ctx.restore()

  // Left side - Controls section
  const leftSideX = canvas.width / 3
  ctx.font = 'bold 24px Arial'
  ctx.fillText('Controls:', leftSideX, 200)

  ctx.font = '20px Arial'
  ctx.fillText('← → Arrow Keys: Move Left/Right', leftSideX, 230)
  ctx.fillText('SPACE: Jump', leftSideX, 260)
  ctx.fillText('Double Jump available with Wing Power-up!', leftSideX, 290)

  // Right side - Power-ups section
  const rightSideX = (canvas.width * 2) / 3
  ctx.font = 'bold 24px Arial'
  ctx.fillText('Power-ups:', rightSideX, 200)

  // Adjust powerup positioning
  const powerupX = rightSideX - 25 // Move icons more to the left
  const powerupTextX = powerupX + 100 // Add more space between icon and text
  const powerupStartY = 230
  const powerupSpacing = 45 // Increase vertical spacing between powerups

  // Draw wrench icon and explanation
  const wrenchIcon = new Image()
  wrenchIcon.src = 'Sprites/Wrench.png'
  ctx.drawImage(wrenchIcon, powerupX, powerupStartY, 30, 30)
  ctx.font = '20px Arial'
  ctx.fillText('= Points', powerupTextX, powerupStartY + 20)

  // Draw wing icon and explanation
  const wingIcon = new Image()
  wingIcon.src = 'Sprites/WingPowerup.png'
  ctx.drawImage(wingIcon, powerupX, powerupStartY + powerupSpacing, 30, 30)
  ctx.fillText(
    '= Double Jump',
    powerupTextX,
    powerupStartY + powerupSpacing + 20
  )

  // Draw bomb icon and explanation
  const bombIcon = new Image()
  bombIcon.src = 'Sprites/Bomb.png'
  ctx.drawImage(bombIcon, powerupX, powerupStartY + powerupSpacing * 2, 30, 30)
  ctx.fillText(
    '= Avoid!',
    powerupTextX,
    powerupStartY + powerupSpacing * 2 + 20
  )

  // Draw start instruction at bottom
  ctx.font = 'bold 24px Arial'
  ctx.fillText('Press SPACE to Start!', canvas.width / 2, canvas.height - 30)
}

// Game loop
function gameLoop() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!gameStarted) {
    drawSplashScreen()
    if (keys['Space']) {
      gameStarted = true
      playSound(sounds.spawn)
    }
    requestAnimationFrame(gameLoop)
    return
  }

  if (gameOver) {
    // Draw game over screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'white'
    ctx.font = '48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 70)

    const finalScore = Math.floor(score / 10)
    ctx.font = '24px Arial'
    ctx.fillText(
      `Score: ${finalScore}`,
      canvas.width / 2,
      canvas.height / 2 - 20
    )

    // Show high score
    if (finalScore > highScore) {
      ctx.fillStyle = '#FFD700' // Gold color for new high score
      ctx.fillText('New High Score!', canvas.width / 2, canvas.height / 2 + 10)
    } else {
      ctx.fillText(
        `High Score: ${highScore}`,
        canvas.width / 2,
        canvas.height / 2 + 10
      )
    }

    ctx.fillStyle = 'white'
    ctx.fillText(
      'Press SPACE to restart',
      canvas.width / 2,
      canvas.height / 2 + 50
    )

    // Check for restart
    if (keys['Space']) {
      resetGame()
    }

    requestAnimationFrame(gameLoop)
    return
  }

  // Draw score and highscore
  ctx.fillStyle = 'white'
  ctx.font = '20px Arial'
  ctx.textAlign = 'left'
  const currentScore = Math.floor(score / 10)
  ctx.fillText(`Score: ${currentScore}`, 10, 30)

  // Show high score next to current score
  ctx.textAlign = 'right'
  ctx.fillText(`High Score: ${highScore}`, canvas.width - 10, 30)

  // Draw speed below high score
  ctx.fillText(`Speed: ${platformSpeed.toFixed(1)}x`, canvas.width - 10, 60)

  // Draw double jump indicator below score
  if (player.canDoubleJump > 0) {
    ctx.save()
    ctx.textAlign = 'left'
    // Draw wing icons based on number of double jumps available
    for (let i = 0; i < player.canDoubleJump; i++) {
      const wingIcon = new Image()
      wingIcon.src = 'Sprites/WingPowerup.png'
      ctx.drawImage(wingIcon, 10 + i * 35, 40, 30, 30)
    }
    // Draw indicator text next to wings
    ctx.fillText(
      `Double Jumps: ${player.canDoubleJump}`,
      10 + player.canDoubleJump * 35 + 10,
      60
    )
    ctx.restore()
  }

  // Gradually increase platform speed (faster acceleration)
  platformSpeed += speedIncreaseFactor

  // Handle horizontal movement
  if (keys['ArrowLeft']) {
    player.velocityX = -playerSpeed
  } else if (keys['ArrowRight']) {
    player.velocityX = playerSpeed
  } else {
    player.velocityX = 0
  }

  // Update player position with bounds checking
  player.x += player.velocityX
  if (player.x < 0) player.x = 0
  if (player.x + player.width > canvas.width)
    player.x = canvas.width - player.width

  // Apply gravity
  player.velocityY += gravity
  player.y += player.velocityY

  // Move platforms
  platforms.forEach((platform) => {
    platform.x -= platformSpeed
  })

  // Remove platforms that are off screen and add new ones
  if (platforms[0].x + platforms[0].width < 0) {
    platforms.shift()
    const lastPlatform = platforms[platforms.length - 1]
    const minGap = 100
    const maxGap = 200
    const gap = Math.random() * (maxGap - minGap) + minGap

    const isBreakable = Math.random() < BREAKABLE_PLATFORM_CHANCE

    const newPlatform = new Platform(
      lastPlatform.x + lastPlatform.width + gap,
      canvas.height - (Math.random() * 150 + 100),
      100 + Math.random() * 50,
      20,
      isBreakable
    )
    platforms.push(newPlatform)

    // Spawn positions for powerups
    const powerupPositions = []

    // Chance to spawn wrench
    if (Math.random() < WRENCH_SPAWN_CHANCE) {
      powerupPositions.push({
        type: 'wrench',
        x: newPlatform.x + newPlatform.width / 2,
        y: newPlatform.y - 50,
      })
    }

    // Chance to spawn wing
    if (Math.random() < WING_SPAWN_CHANCE) {
      powerupPositions.push({
        type: 'wing',
        x: newPlatform.x + newPlatform.width / 2 - 40, // Offset to avoid overlap
        y: newPlatform.y - 60,
      })
    }

    // Chance to spawn bomb
    if (Math.random() < BOMB_SPAWN_CHANCE) {
      // Only spawn bomb if there's no other powerup at this position
      if (powerupPositions.length === 0) {
        bombs.push(
          new Bomb(newPlatform.x + newPlatform.width / 2, newPlatform.y - 55)
        )
      }
    }

    // Create the powerups that were selected
    powerupPositions.forEach((pos) => {
      if (pos.type === 'wrench') {
        wrenches.push(new Wrench(pos.x, pos.y))
      } else if (pos.type === 'wing') {
        wings.push(new Wing(pos.x, pos.y))
      }
    })
  }

  // Move and remove powerups
  wrenches = wrenches.filter((wrench) => {
    wrench.x -= platformSpeed
    return wrench.x + wrench.width > 0
  })

  wings = wings.filter((wing) => {
    wing.x -= platformSpeed
    return wing.x + wing.width > 0
  })

  bombs = bombs.filter((bomb) => {
    const scaleFactor = 1 + Math.floor(score / 10) * BOMB_SCALE_FACTOR
    bomb.width = bomb.baseWidth * scaleFactor
    bomb.height = bomb.baseHeight * scaleFactor

    // Center the hitbox as the bomb grows
    const xOffset = (bomb.width - bomb.baseWidth) / 2
    const yOffset = (bomb.height - bomb.baseHeight) / 2

    if (
      player.x < bomb.x - xOffset + bomb.width &&
      player.x + player.width > bomb.x - xOffset &&
      player.y < bomb.y - yOffset + bomb.height &&
      player.y + player.height > bomb.y - yOffset
    ) {
      gameOver = true
      playSound(sounds.crash)
      return false
    }
    return true
  })

  // Check collision with platforms
  let onPlatform = false
  platforms.forEach((platform) => {
    if (
      !platform.broken &&
      player.y + player.height >= platform.y &&
      player.y + player.height <= platform.y + platform.height + 5 &&
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.width &&
      player.velocityY >= 0
    ) {
      onPlatform = true
      player.isJumping = false
      player.y = platform.y - player.height
      player.velocityY = 0

      if (platform.isBreakable && !platform.decaying) {
        platform.startDecay()
        playSound(sounds.crash)
      }
    }
  })

  // Check collision with powerups
  wrenches = wrenches.filter((wrench) => {
    if (
      player.x < wrench.x + wrench.width &&
      player.x + player.width > wrench.x &&
      player.y < wrench.y + wrench.height &&
      player.y + player.height > wrench.y
    ) {
      score += WRENCH_SCORE
      playSound(sounds.collect)
      return false
    }
    return true
  })

  wings = wings.filter((wing) => {
    if (
      player.x < wing.x + wing.width &&
      player.x + player.width > wing.x &&
      player.y < wing.y + wing.height &&
      player.y + player.height > wing.y
    ) {
      player.canDoubleJump += 1 // Increment double jump counter
      playSound(sounds.spawn)
      return false
    }
    return true
  })

  // Handle jump
  if (keys['Space']) {
    if (!player.isJumping && onPlatform) {
      player.velocityY = jumpForce
      player.isJumping = true
      player.isFlipping = true
      rotation = 0
      player.hasDoubleJumped = false
      playSound(sounds.jump)
    } else if (player.canDoubleJump > 0 && player.velocityY > 0) {
      player.velocityY = jumpForce
      player.isFlipping = true
      rotation = 0
      player.canDoubleJump -= 1 // Decrement double jump counter
      playSound(sounds.jump)
    }
  }

  // Update flip animation
  if (player.isFlipping) {
    rotation += 0.2
    if (rotation >= Math.PI * 2) {
      rotation = 0
      player.isFlipping = false
    }
  }

  // Keep player in bounds
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height
    player.velocityY = 0
    player.isJumping = false
    gameOver = true
    playSound(sounds.crash)
  }

  // Update score
  score += 1

  // Draw powerups
  wrenches.forEach((wrench) => wrench.draw())
  wings.forEach((wing) => wing.draw())
  bombs.forEach((bomb) => bomb.draw())

  // Draw platforms
  platforms.forEach((platform) => platform.draw())

  // Draw touch controls
  drawTouchControls()

  // Draw player with rotation
  ctx.save()
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2)
  if (player.isFlipping) {
    ctx.rotate(rotation)
  }
  ctx.scale(-1, 1)
  ctx.translate(-player.width / 2, -player.height / 2)
  ctx.drawImage(player.image, 0, 0, player.width, player.height)
  ctx.restore()

  // Continue game loop
  requestAnimationFrame(gameLoop)
}

// Start the game when the image is loaded
player.image.onload = () => {
  gameLoop()
}
