let redis = require('redis')
let events = require('events')
let createClient = redis.createClient
let defaultConfig = {
	ttl: 30,
	prefix: 'node-plugin-cache',
	uri: 'redis://127.0.0.1:6379',
	limit_retry_time: 3600000,
	limit_retry_attempts: 10
}

const CACHE_NOT_CONNECTED = 'cache not connected'

module.exports = function(hostConfig = {}) {
	let cacheConfig = Object.assign({}, hostConfig, defaultConfig)


	class Cache extends events.EventEmitter {
		constructor() {
			super()			
			this.client = createClient(cacheConfig.uri, { 
				prefix: cacheConfig.cache,
				retry_strategy: (options) => {
					if (options.error.code === 'ECONNREFUSED') {
						if(process.env.NODE_ENV === 'production' || Object.keys(hostConfig).length > 0) {
							return this.emit('error', new Error('Cache server:Connection refused'))	
						}	
						
				    }

				    if (options.total_retry_time > cacheConfig.limit_retry_time) {
				    	return this.emit('error','Cache retry', 'Time exhausted')
				    }

				    if (options.times_connected > cacheConfig.limit_retry_attempts) {
				    	return this.emit('error','Cache retry', 'Attempts exhausted')
				    }
				    
				    return this.emit('warn','Cache retry', `Attempt ${options.attempt}`)
				}
			})
			

			this.client.on('error', error => this.emit)
		}

		get (key) {
			return new Promise ( (resolve, reject) => {
				
				this.emit('debug','cache get', key)

				if (!this.isCacheConnected(resolve, reject)) {
					return
				}

				this.client.get(key, (err, result) => {
					if(err) {
						return reject(err)
					}

					try {
						if(result) {
							this.emit('debug','cache hit', key)
						} else {
							this.emit('debug','cache miss', key)
						}

						resolve(JSON.parse(result))	

					} catch( e ) {
						reject(e)
					}
					
				})
			})
		}

		getOrSet ( key, action = Promise.resolve, ttl = cacheConfig.ttl) {
			
			this.emit('debug','cache getOrSet', key)
			
			return new Promise ( (resolve, reject) => {
				this.get(key)
					.then( (result) => {
						if(result) {
							return resolve(result)
						}

						action()
							.then( (value) => {
								
								this.set(key, value, ttl)
									.then( (data) => {
										this.emit('debug','cache set', key, ttl)
										resolve(data)
									})
									.catch((error) => {
										this.emit('warn','cache error', error.message)
										reject(error)
									})
								
							})
							.catch(reject)
					})
					.catch(reject)
			})	
		}

		set ( key, content, ttl = cacheConfig.ttl) {
			let value = {
				content: content,
				timestamp: Date.now(),
				ttl: ttl
			}

			return new Promise (( resolve, reject) => {

				if (!this.isCacheConnected(resolve, reject, value)) {
					return
				}

				this.client.set(key, JSON.stringify(value), (err) => {
					if(err) {
						return reject(err)
					}

					if(ttl && isNaN(parseInt(ttl)) === false) {
						this.client.expire(key, parseInt(ttl))	
					}
					
					resolve(value)
				})	
			})
			
		}

		unset (key) {
			return new Promise ( (resolve , reject) => {
				if (!this.isCacheConnected(resolve, reject)) {
					return
				}

				this.client.del(key, (err) => {
					if(err) return reject(err)
				})
			})
		}


		isCacheConnected (resolve, reject, success = null) {
			if (this.client.connected === false) {
				this.emit('debug','cache not connected')
				return  process.env.NODE_ENV === 'production' ? reject(CACHE_NOT_CONNECTED) : resolve(success)
			}
		}		
	}

	global.cache = global.cache || new Cache()	
}