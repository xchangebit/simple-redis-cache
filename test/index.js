var expect = require("chai").expect;
var sinon = require('sinon')
var Cache = require("../")


describe('Redis cache', function() {
	it('should create a global object', function() {
		Cache()
		expect(global).to.have.property('cache')
	})

	describe('global cache', function() {
		it('should have a get method', function() {
			expect(cache).to.have.property('get')
		})

		it('should have a set method', function() {
			expect(cache).to.have.property('set')
		})

		it('should have a getOrSet method', function() {
			expect(cache).to.have.property('getOrSet')
		})
	})


	describe('get or set', function(done) {
		it('should calculate value if get returns null', function(done) {
			let value = 'value'
			let method = function() {
				return Promise.resolve(value)
			}
			let ttl = 100

			cache.getOrSet('key', method, ttl)
				.then( function (result) {
					done()
				})
				.catch(done)
		})


		it('should try to get the key', (done) => {
			let value = 'value'
			let method = function() {
				return Promise.resolve(value)
			}
			let ttl = 100

			let get = sinon.spy(cache, 'get')

			cache.getOrSet('key', method, ttl)
				.then( function (result) {
					let actual = get.calledOnce
					get.restore()
					expect(actual).to.be.true
					done()
				})
				.catch((error) => {
					get.restore()
					done(error)
				})
		})
	})
})