<template>
	<view class="content">
		<!-- ========== App端：web-view 加载地图壳 ========== -->
		<!-- #ifdef APP-PLUS -->
		<web-view class="map-container" ref="webViewRef" :src="webViewSrc"
			@message="handleWebMessage" @load="webViewLoad"></web-view>
		<!-- #endif -->

		<!-- ========== 小程序端：uni-app 原生 map 组件 ========== -->
		<!-- #ifdef MP-WEIXIN -->
		<map
			id="map-mini"
			style="width: 100%; height: 100%; position: absolute; top: 0; left: 0;"
			:latitude="mapCenter.latitude"
			:longitude="mapCenter.longitude"
			:markers="markers"
			:polyline="polylines"
			:polygons="polygons"
			:include-points="includePoints"
			:scale="mapScale"
			show-location
			@markertap="onMarkerTap"
			@tap="onMapTap"
			@regionchange="onRegionChange"
		></map>
		<!-- #endif -->

		<!-- ========== H5端：aimap SDK 直接集成 ========== -->
		<!-- #ifdef H5 -->
		<view id="map" class="map-container-h5"></view>
		<!-- #endif -->

		<!-- ========== 浮层：小程序/H5 端使用，App 端 UI 在 map_view.html 内 ========== -->
		<!-- #ifndef APP-PLUS -->
		<view class="float-layer">
			<view v-if="wzLocation" class="location-info">
				<view class="name">{{wzLocation.address.name}}</view>
				<view class="name">{{wzLocation.place.name}}</view>
				<view class="sub">{{wzLocation.longitude}} , {{wzLocation.latitude}}</view>
				<view class="time">{{wzLocation.timestamp}}</view>
			</view>
			<view class="btn-group" :style="btnGroupStyle">
				<button v-for="btn in buttons" :key="btn.id" @click="handleBtnClick(btn.id)" class="map-btn">{{btnText(btn)}}</button>
			</view>
		</view>
		<!-- #endif -->
	</view>
</template>

<script>
	import * as wzLocation from '@/utils/wz_sdk_uniapp.js';
	import { LOCATION_KEY, POI_KEY, MAP_ACCESS_TOKEN, MAP_BASE_URL } from '@/utils/config.js';
	import { createMapController, MAP_STYLES } from '@/utils/map.js';

	export default {
		data() {
			return {
				webViewSrc: 'static/map/map_view.html',
				webViewReady: false,
				map: null,
				mapCenter: { latitude: 27.945061, longitude: 107.191693 },
				markers: [],
				polylines: [],
				polygons: [],
				includePoints: [],
				mapScale: 13,
				mapController: null,
				isDark: false,
				wzLocation: {
					accuracy: 0,
					address: { name: "初始地址" },
					place: { name: "初始位置" },
					latitude: 27.945061,
					longitude: 107.191693,
					source: "",
					spatialReference: "",
					timestamp: new Date().toLocaleString()
				},
				// 按钮定义（App 端通过 evalJS 下发到 map_view.html，小程序/H5 通过 v-for 渲染）
				buttons: [
					{ id: 'singleClick',    text: '单次定位' },
					{ id: 'continueClick',   text: '连续定位' },
					{ id: 'stopLocation',   text: '停止定位' },
					{ id: 'getAddress',     text: '获取地址' },
					{ id: 'getGeoCode',     text: '正地理' },
					{ id: 'poiSearch',      text: 'poi 搜索' },
					{ id: 'poiNearBySearch',text: 'poi 附近搜索' },
					{ id: 'getMapCenter',   text: '获取中心点' },
					{ id: 'getMapBounds',   text: '获取视野' },
					{ id: 'toggleStyle',    text: '暗黑地图' }
				]
			}
		},
		computed: {
			btnGroupStyle() {
				// 非 App 端按钮在底部
				return { bottom: 'calc(50rpx + env(safe-area-inset-bottom))' };
			}
		},
		onReady() {
			this.initMapController();
		},
		methods: {
			// 按钮文本（toggleStyle 根据状态显示不同文字）
			btnText(btn) {
				if (btn.id === 'toggleStyle') {
					return this.isDark ? '浅色地图' : '暗黑地图';
				}
				return btn.text;
			},

			// 统一按钮分发
			handleBtnClick(id) {
				const methodMap = {
					singleClick:      this.singleClick,
					continueClick:     this.continueClick,
					stopLocation:     this.stopLocation,
					getAddress:       this.getAddress,
					getGeoCode:       this.getGeoCode,
					poiSearch:        this.poiSearch,
					poiNearBySearch:  this.poiNearBySearch,
					getMapCenter:     this.getMapCenter,
					getMapBounds:     this.getMapBounds,
					toggleStyle:      this.toggleStyle
				};
				if (methodMap[id]) methodMap[id]();
			},

			// ========== 地图控制器初始化 ==========
			initMapController() {
				// #ifdef APP-PLUS
				this.mapController = createMapController('app-plus', {
					sendEvalJS: (code) => this._appEvalJS(code),
					onMessage: (handler) => { this._appMessageHandler = handler; },
					onMessageReady: () => this.webViewReady
				});
				setTimeout(() => { if (!this.webViewReady) { this.webViewReady = true; this._renderAppUI(); } }, 1500);
				// #endif

				// #ifdef MP-WEIXIN
				this.mapController = createMapController('mp-weixin', { vm: this });
				// #endif

				// #ifdef H5
				this._initH5Map();
				// #endif

				if (this.mapController) {
					this.mapController.onClick((point) => {
						console.log('[Map] 点击坐标：', point);
						uni.showToast({
							title: `点击: ${point.longitude.toFixed(4)}, ${point.latitude.toFixed(4)}`,
							icon: 'none', duration: 1500
						});
					});
				}
			},

			// ========== App端：构建 UI 下发到 web-view ==========
			_rpx(val) {
				// #ifdef APP-PLUS
				const info = uni.getSystemInfoSync();
				return Math.round(val * info.screenWidth / 750);
				// #endif
			},
			// 注入到 web-view 的样式（rpx 值统一在此定义，_rpx 自动转 px）
			// 修改样式只需改这里的 rpx 数值即可，和 Vue <style> 中的值保持一致
			_appStyles() {
				// #ifdef APP-PLUS
				var r = this._rpx.bind(this);
				return ''
					+ '.aul{position:absolute;top:' + r(30) + 'px;left:' + r(30) + 'px;z-index:999;'
					+ 'background:rgba(255,255,255,0.92);padding:' + r(20) + 'px ' + r(25) + 'px;'
					+ 'border-radius:' + r(12) + 'px;box-shadow:0 ' + r(2) + 'px ' + r(12) + 'px rgba(0,0,0,0.15);'
					+ 'max-width:75vw;pointer-events:none;}'
					+ '.aul .n{font-size:' + r(34) + 'px;font-weight:bold;color:#333;}'
					+ '.aul .s{font-size:' + r(28) + 'px;color:#666;}'
					+ '.aul .t{font-size:' + r(26) + 'px;color:#999;}'
					+ '.abg{position:absolute;bottom:calc(' + r(50) + 'px + env(safe-area-inset-bottom));'
					+ 'left:' + r(20) + 'px;right:' + r(20) + 'px;z-index:999;'
					+ 'display:flex;flex-wrap:wrap;justify-content:center;gap:' + r(12) + 'px;}'
					+ '.abtn{background:rgba(45,108,234,0.9);color:#fff;border:none;'
					+ 'border-radius:' + r(8) + 'px;padding:' + r(14) + 'px ' + r(22) + 'px;'
					+ 'font-size:' + r(24) + 'px;white-space:nowrap;}';
				// #endif
			},
			_renderAppUI() {
				// #ifdef APP-PLUS
				var loc = this.wzLocation;
				var text = this.isDark ? '浅色地图' : '暗黑地图';

				var btns = '';
				for (var i = 0; i < this.buttons.length; i++) {
					var b = this.buttons[i];
					btns += '<button class="abtn" data-id="' + b.id + '">'
						+ (b.id === 'toggleStyle' ? text : b.text) + '</button>';
				}

				var html = '<style>' + this._appStyles() + '</style>'
					+ '<div class="aul">'
					+ '<div class="n">' + (loc.address.name || '--') + '</div>'
					+ '<div class="n">' + (loc.place.name || '--') + '</div>'
					+ '<div class="s">' + loc.longitude + ' , ' + loc.latitude + '</div>'
					+ '<div class="t">' + (loc.timestamp || '--') + '</div>'
					+ '</div>'
					+ '<div class="abg">' + btns + '</div>';

				this._appEvalJS("if(typeof __mapSetUI==='function')__mapSetUI('" + html.replace(/'/g, "\\'") + "')");
				// #endif
			},

			// ========== App端：web-view 通信 ==========
			webViewLoad() {

				const delay = process.env.UNI_PLATFORM === 'app-plus' ? 500 : 0;
				setTimeout(() => { this.webViewReady = true; this._renderAppUI(); }, delay);
			},

			_appEvalJS(code) {
				// #ifdef APP-PLUS
				const wv = this._getAppWebView();
				if (wv && typeof wv.evalJS === 'function') { wv.evalJS(code); }
				// #endif
			},

			_getAppWebView() {
				// #ifdef APP-PLUS
				const ref = this.$refs.webViewRef;
				let wv = ref && (ref.$el || ref._nativeInstance || ref);
				if (!wv || typeof wv.evalJS !== 'function') {
					const pages = getCurrentPages();
					const page = pages[pages.length - 1];
					if (page && page.$getAppWebview) {
						const children = page.$getAppWebview().children();
						for (let i = 0; i < children.length; i++) {
							if (children[i].getURL && children[i].getURL().includes('map_view.html')) { wv = children[i]; break; }
						}
					}
				}
				return wv;
				// #endif
			},

			handleWebMessage(e) {
				// App端按钮点击 → 统一分发
				// #ifdef APP-PLUS
				const msgs = e && e.detail && e.detail.data;
				if (msgs && Array.isArray(msgs)) {
					const last = msgs[msgs.length - 1];
					if (last && last.type === 'buttonClick' && last.id) {
						this.handleBtnClick(last.id);
						return;
					}
				}
				// #endif
				// 原有 mapController 消息处理
				if (this._appMessageHandler) this._appMessageHandler(e);
			},

			// ========== H5端：aimap SDK ==========
			_initH5Map() {
				const tryInit = () => {
					if (!window.aimap) { setTimeout(tryInit, 300); return; }
					try {
						window.aimap.accessToken = MAP_ACCESS_TOKEN;
						window.aimap.baseApiUrl = MAP_BASE_URL;
						this.map = new window.aimap.Map({
							container: document.getElementById('map'),
							center: [121.50547, 31.236532],
							zoom: 13, pitch: 0, bearing: 0,
							style: MAP_STYLES.white
						});
						this.mapController = createMapController('h5', { mapInstance: this.map });
						if (this.mapController) {
							this.mapController.onClick((point) => {
								console.log('[Map] 点击坐标：', point);
								uni.showToast({ title: `点击: ${point.longitude.toFixed(4)}, ${point.latitude.toFixed(4)}`, icon: 'none', duration: 1500 });
							});
						}
					} catch (e) { console.error('[H5] 地图初始化失败：', e); }
				};
				tryInit();
			},

			// ========== 地图操作 ==========
			async getMapCenter() {
				if (!this.mapController) return;
				const center = await this.mapController.getCenter();
				if (center) {
					uni.showToast({ title: `中心: ${center.longitude.toFixed(4)}, ${center.latitude.toFixed(4)}`, icon: 'none', duration: 2000 });
				}
			},

			async getMapBounds() {
				if (!this.mapController) return;
				const bounds = await this.mapController.getBounds();
				if (bounds) {
					console.log('[Map] 视野：', bounds);
					uni.showToast({
						title: `SW: ${bounds.sw.longitude.toFixed(2)},${bounds.sw.latitude.toFixed(2)}  NE: ${bounds.ne.longitude.toFixed(2)},${bounds.ne.latitude.toFixed(2)}`,
						icon: 'none', duration: 2500
					});
				}
			},

			toggleStyle() {
				this.isDark = !this.isDark;
				if (this.mapController) {
					this.mapController.setStyle(this.isDark ? MAP_STYLES.dark : MAP_STYLES.white);
				}
				// #ifdef APP-PLUS
				this._renderAppUI();
				// #endif
			},

			onMapTap(e) {
				if (this.mapController && this.mapController.handleTap) {
					this.mapController.handleTap(e);
				}
			},

			onMarkerTap(e) {
				console.log('[Mini] 标记被点击：', e.detail.markerId);
			},

			onRegionChange(e) {
				if (e.type === 'end' && e.detail && e.detail.centerLocation) {
					console.log('[Mini] 地图移动结束：', e.detail.centerLocation);
				}
			},

			// ========== 定位业务逻辑 ==========
			_requestLocationPermission(callback) {
				const setting = uni.getSystemSetting();
				if (setting.locationEnabled) {
					callback();
					return;
				}
				uni.getLocation({
					type: 'wgs84',
					isHighAccuracy: true,
					success: () => {
						callback();
					},
					fail: (e) => {
						console.log('定位权限请求失败：', e.errMsg);
						uni.showModal({
							title: '需要定位权限',
							content: '请在系统设置中开启定位权限，以便获取您的位置信息',
							confirmText: '去设置',
							success: (res) => {
								if (res.confirm) {
									// #ifdef APP-PLUS
									if (plus.os.name === 'iOS') {
										plus.runtime.openURL('app-settings:');
									} else {
										const main = plus.android.runtimeMainActivity();
										const Intent = plus.android.importClass('android.content.Intent');
										const Settings = plus.android.importClass('android.provider.Settings');
										const Uri = plus.android.importClass('android.net.Uri');
										const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
										intent.setData(Uri.fromParts('package', main.getPackageName(), null));
										main.startActivity(intent);
									}
									// #endif
								}
							}
						});
					}
				});
			},
			singleClick() {
				const deviceInfo = uni.getDeviceInfo();
				wzLocation.initOption(LOCATION_KEY, deviceInfo.deviceId, true, 0);
				this._requestLocationPermission(() => {
					wzLocation.getLocation(
						res => { res.timestamp = new Date(res.timestamp).toLocaleString(); this.wzLocation = res; this._updateMapLocation(res); },
						fail => {
							console.log("fail", fail.code, fail.msg);
							uni.showToast({ title: fail.msg || '定位失败', icon: 'none', duration: 2000 });
						}
					);
				});
			},
			continueClick() {
				const deviceInfo = uni.getDeviceInfo();
				wzLocation.initOption(LOCATION_KEY, deviceInfo.deviceId, false, 10000);
				this._requestLocationPermission(() => {
					wzLocation.getLocation(
						res => { res.timestamp = new Date(res.timestamp).toLocaleString(); this.wzLocation = res; this._updateMapLocation(res); },
						fail => {
							console.log("fail", fail.code, fail.msg);
							uni.showToast({ title: fail.msg || '定位失败', icon: 'none', duration: 2000 });
						}
					);
				});
			},
			getAddress() {
				wzLocation.setAk(LOCATION_KEY);
				wzLocation.getReverseCode(107.191693, 27.945061, 'wgs84').then(
					(res) => {
						this.wzLocation.address.name = res.address.name;
						// #ifdef APP-PLUS
						if (this.mapController) this.mapController.updateLocation(this.wzLocation);
						// #endif
					},
					(error) => console.log("error", error)
				);
			},
			getGeoCode() {
				wzLocation.setAk(LOCATION_KEY);
				wzLocation.getGeoCode("旺座", '西安市').then(
					(res) => {
						this.wzLocation.address.name = res[0].address.name;
						this.wzLocation.longitude = res[0].geoPoint.split(',')[0];
						this.wzLocation.latitude = res[0].geoPoint.split(',')[1];
						this._updateMapLocation(this.wzLocation);
					},
					(error) => console.log("error", error)
				);
			},
			poiSearch() {
				wzLocation.setAk(POI_KEY);
				wzLocation.poiSearch("泛悦城T2", '武汉市', 2, 20).then(
					(res) => {
						this.wzLocation.address.name = res[0].address.name;
						this.wzLocation.longitude = res[0].geoPoint.split(',')[0];
						this.wzLocation.latitude = res[0].geoPoint.split(',')[1];
						this._updateMapLocation(this.wzLocation);
					},
					(error) => console.log("error", error)
				);
			},
			poiNearBySearch() {
				wzLocation.setAk(POI_KEY);
				wzLocation.poiNearbySearch("乒乓球", "体育场馆", '120.59986,31.25979').then(
					(res) => {
						this.wzLocation.address.name = res[0].address.name;
						this.wzLocation.longitude = res[0].geoPoint.split(',')[0];
						this.wzLocation.latitude = res[0].geoPoint.split(',')[1];
						this._updateMapLocation(this.wzLocation);
					},
					(error) => console.log("error", error)
				);
			},
			stopLocation() {
				wzLocation.stopLocation();
			},

			_updateMapLocation(data) {
				if (!this.mapController) return;
				this.mapController.updateLocation(data);
				// #ifdef APP-PLUS
				this._renderAppUI();
				// #endif
			}
		}
	}
</script>

<style>
	/* #ifdef MP-WEIXIN || H5 */
	page { width: 100%; height: 100%; }
	/* #endif */
	/* #ifdef H5 */
	html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
	.content { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; }
	.map-container-h5 { z-index: 0 !important; }
	.map-container-h5 * { z-index: 0 !important; }
	.float-layer { z-index: 10 !important; position: fixed !important; }
	.location-info { top: calc(30rpx + env(safe-area-inset-top)) !important; }
	/* #endif */
</style>

<style scoped>
	.content {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}

	/* ========== App 端 ========== */
	.map-container {
		position: absolute; top: 0; left: 0; right: 0; bottom: 0;
		z-index: 0;
	}
	::v-deep .uni-webview { z-index: 0 !important; }

	/* ========== H5 端 ========== */
	.map-container-h5 {
		width: 100%; height: 100%;
		position: absolute; top: 0; left: 0;
		z-index: 1;
	}

	/* ========== 浮层（仅小程序/H5） ========== */
	.float-layer {
		position: absolute;
		top: 0; left: 0;
		width: 100%; height: 100%;
		z-index: 999;
		pointer-events: none;
	}

	.location-info {
		position: absolute;
		top: 30rpx;
		left: 30rpx;
		pointer-events: auto;
		background: rgba(255, 255, 255, 0.92);
		padding: 20rpx 25rpx;
		border-radius: 12rpx;
		box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.15);
		max-width: 75vw;
	}

	.btn-group {
		position: absolute;
		left: 20rpx;
		right: 20rpx;
		pointer-events: auto;
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: center;
		gap: 12rpx;
	}

	.map-btn {
		background: rgba(45, 108, 234, 0.9);
		color: #fff;
		border: none;
		border-radius: 8rpx;
		padding: 14rpx 22rpx;
		font-size: 24rpx;
		white-space: nowrap;
	}
	.map-btn:active { background: rgba(30, 80, 200, 0.9); }

	.name { font-size: 34rpx; font-weight: bold; }
	.sub  { font-size: 28rpx; color: #666; }
	.time { font-size: 26rpx; color: #999; }
</style>
