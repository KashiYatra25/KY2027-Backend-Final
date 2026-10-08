/**
 * Lua Scripts for Rate Limiting
 *
 * Using Lua scripts ensures atomicity - critical for distributed rate limiting.
 * All operations within a script execute as a single Redis command.
 */

/**
 * Sliding Window Rate Limiter Script
 *
 * Uses a sorted set to track requests with timestamps.
 * More accurate than fixed window, prevents burst at window boundaries.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = window size in seconds
 * ARGV[2] = max requests allowed
 * ARGV[3] = current timestamp (ms)
 *
 * Returns: [allowed (0/1), remaining, resetTime (ms)]
 */
export const SLIDING_WINDOW_RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local window = tonumber(ARGV[1])
  local maxRequests = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local windowStart = now - (window * 1000)

  -- Remove expired entries
  redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

  -- Count current requests in window
  local currentCount = redis.call('ZCARD', key)

  if currentCount < maxRequests then
    -- Add this request
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
    redis.call('PEXPIRE', key, window * 1000)
    
    local remaining = maxRequests - currentCount - 1
    local resetTime = now + (window * 1000)
    
    return {1, remaining, resetTime}
  else
    -- Get oldest entry to calculate reset time
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetTime = oldest[2] and (tonumber(oldest[2]) + (window * 1000)) or (now + (window * 1000))
    
    return {0, 0, resetTime}
  end
`;

/**
 * Fixed Window Rate Limiter Script (Simpler, slightly less accurate)
 *
 * Uses simple counter with expiry. Good for high-throughput scenarios
 * where slight inaccuracy at window boundaries is acceptable.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = window size in seconds
 * ARGV[2] = max requests allowed
 *
 * Returns: [allowed (0/1), currentCount, ttl]
 */
export const FIXED_WINDOW_RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local window = tonumber(ARGV[1])
  local maxRequests = tonumber(ARGV[2])

  local current = redis.call('GET', key)
  
  if current == false then
    -- First request in window
    redis.call('SET', key, 1, 'EX', window)
    return {1, 1, window}
  end
  
  local count = tonumber(current)
  
  if count < maxRequests then
    -- Increment and allow
    local newCount = redis.call('INCR', key)
    local ttl = redis.call('TTL', key)
    return {1, newCount, ttl}
  else
    -- Limit exceeded
    local ttl = redis.call('TTL', key)
    return {0, count, ttl}
  end
`;

/**
 * Token Bucket Rate Limiter Script
 *
 * Allows bursts while maintaining average rate.
 * Good for APIs that need to handle occasional spikes.
 *
 * KEYS[1] = bucket key
 * ARGV[1] = bucket capacity (max tokens)
 * ARGV[2] = refill rate (tokens per second)
 * ARGV[3] = current timestamp (ms)
 * ARGV[4] = tokens to consume (usually 1)
 *
 * Returns: [allowed (0/1), remainingTokens, msUntilNextToken]
 */
export const TOKEN_BUCKET_RATE_LIMIT_SCRIPT = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refillRate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local requested = tonumber(ARGV[4]) or 1

  -- Get current state
  local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
  local tokens = tonumber(data[1]) or capacity
  local lastRefill = tonumber(data[2]) or now

  -- Calculate tokens to add based on time elapsed
  local elapsed = (now - lastRefill) / 1000
  local tokensToAdd = elapsed * refillRate
  tokens = math.min(capacity, tokens + tokensToAdd)

  if tokens >= requested then
    -- Consume tokens
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
    redis.call('PEXPIRE', key, math.ceil(capacity / refillRate) * 1000 + 1000)
    
    local msUntilNext = 0
    if tokens < 1 then
      msUntilNext = math.ceil((1 - tokens) / refillRate * 1000)
    end
    
    return {1, math.floor(tokens), msUntilNext}
  else
    -- Not enough tokens
    local msUntilEnough = math.ceil((requested - tokens) / refillRate * 1000)
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
    redis.call('PEXPIRE', key, math.ceil(capacity / refillRate) * 1000 + 1000)
    
    return {0, math.floor(tokens), msUntilEnough}
  end
`;

/**
 * Simple Increment Rate Limiter (Legacy compatible)
 *
 * Same pattern as your existing OTP limiter.
 * Simple counter with auto-expiry on first request.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = window size in seconds
 *
 * Returns: current count
 */
export const SIMPLE_INCREMENT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return count
`;
