/**
 * 统一地图控制器 — 封装多端地图差异，提供一致的 API
 *
 * 坐标系：统一使用 latitude/longitude
 * 点格式：{ latitude: number, longitude: number }
 * bounds 格式：{ sw: {latitude, longitude}, ne: {latitude, longitude} }
 *
 * 平台实现：
 *   APP-PLUS  → 通过 evalJS 操作 web-view 内的 aimap-gl
 *   MP-WEIXIN → 直接操作 uni-app <map> 组件数据
 *   H5        → 直接调用 aimap-gl SDK
 */

// ======================== APP-PLUS 实现 ========================
class AppMapController {
	constructor(options) {
		this._sendEvalJS = options.sendEvalJS;
		this._onMessage = options.onMessage;
		this._onMessageReady = options.onMessageReady;
		this._clickHandler = null;
		this._pendingCallback = null; // { resolve, type }

		this._onMessage((e) => {
			const msgs = e && e.detail && e.detail.data;
			if (!msgs || !Array.isArray(msgs)) return;
			const last = msgs[msgs.length - 1];
			if (!last || last.type !== 'mapEvent') return;

			// getCenter 回调
			if (last.event === 'center' && this._pendingCallback && this._pendingCallback.type === 'center') {
				this._pendingCallback.resolve(last.data);
				this._pendingCallback = null;
			}
			// getBounds 回调
			if (last.event === 'bounds' && this._pendingCallback && this._pendingCallback.type === 'bounds') {
				this._pendingCallback.resolve(last.data);
				this._pendingCallback = null;
			}
			// click 回调（持续监听，不消耗 pendingCallback）
			if (last.event === 'click' && this._clickHandler && last.data) {
				this._clickHandler(last.data);
			}
		});
	}

	_eval(code) {
		if (!this._onMessageReady || !this._onMessageReady()) {
			console.warn('[AppMap] web-view 未就绪');
			return;
		}
		this._sendEvalJS(code);
	}

	// ---- 基础操作 ----

	getCenter() {
		return new Promise((resolve) => {
			this._pendingCallback = { resolve, type: 'center' };
			this._eval('if(typeof __mapGetCenter==="function")__mapGetCenter()');
			setTimeout(() => { if (this._pendingCallback) { this._pendingCallback.resolve(null); this._pendingCallback = null; } }, 3000);
		});
	}

	flyTo(center, zoom = 15) {
		this._eval(`if(typeof __mapFlyTo==="function")__mapFlyTo(${JSON.stringify(center)},${zoom})`);
	}

	moveTo(center) {
		this._eval(`if(typeof __mapMoveTo==="function")__mapMoveTo(${JSON.stringify(center)})`);
	}

	getBounds() {
		return new Promise((resolve) => {
			this._pendingCallback = { resolve, type: 'bounds' };
			this._eval('if(typeof __mapGetBounds==="function")__mapGetBounds()');
			setTimeout(() => { if (this._pendingCallback) { this._pendingCallback.resolve(null); this._pendingCallback = null; } }, 3000);
		});
	}

	fitBounds(bounds, padding = 50) {
		this._eval(`if(typeof __mapFitBounds==="function")__mapFitBounds(${JSON.stringify(bounds)},${padding})`);
	}

	setStyle(style) {
		this._eval(`if(typeof __mapSetStyle==="function")__mapSetStyle("${style}")`);
	}

	onClick(handler) {
		this._clickHandler = handler;
	}

	offClick() {
		this._clickHandler = null;
	}

	// ---- 覆盖物 ----

	addMarker(point, options = {}) {
		const opts = { title: options.title || '', color: options.color || '#007aff' };
		this._eval(`if(typeof __mapAddMarker==="function")__mapAddMarker(${JSON.stringify(point)},${JSON.stringify(opts)})`);
	}

	addPolyline(points, options = {}) {
		const opts = { color: options.color || '#007aff', width: options.width || 3, dashed: options.dashed || false };
		this._eval(`if(typeof __mapAddPolyline==="function")__mapAddPolyline(${JSON.stringify(points)},${JSON.stringify(opts)})`);
	}

	addPolygon(points, options = {}) {
		const opts = { fillColor: options.fillColor || 'rgba(0,122,255,0.2)', strokeColor: options.strokeColor || '#007aff', strokeWidth: options.strokeWidth || 2 };
		this._eval(`if(typeof __mapAddPolygon==="function")__mapAddPolygon(${JSON.stringify(points)},${JSON.stringify(opts)})`);
	}

	clear() {
		this._eval('if(typeof __mapClear==="function")__mapClear()');
	}

	updateLocation(locationData) {
		this._eval(`if(typeof __mapUpdateLocation==="function")__mapUpdateLocation(${JSON.stringify(locationData)})`);
	}
}

// ======================== MP-WEIXIN 实现 ========================
class MiniMapController {
	constructor(options) {
		this._vm = options.vm;
		this._clickHandler = null;
	}

	// ---- 基础操作 ----

	getCenter() {
		return Promise.resolve({
			latitude: this._vm.mapCenter.latitude,
			longitude: this._vm.mapCenter.longitude
		});
	}

	flyTo(center, zoom = 13) {
		this._vm.mapCenter = { latitude: center.latitude, longitude: center.longitude };
		if (zoom) this._vm.mapScale = zoom;
	}

	moveTo(center) {
		this._vm.mapCenter = { latitude: center.latitude, longitude: center.longitude };
	}

	async getBounds() {
		// 小程序通过 createMapContext 获取
		const mapCtx = uni.createMapContext('map-mini', this._vm);
		return new Promise((resolve) => {
			mapCtx.getRegion({
				success: (res) => {
					resolve({
						sw: { latitude: res.southwest.latitude, longitude: res.southwest.longitude },
						ne: { latitude: res.northeast.latitude, longitude: res.northeast.longitude }
					});
				},
				fail: () => resolve(null)
			});
		});
	}

	fitBounds(bounds, padding = 50) {
		// 小程序通过 include-points 属性实现
		this._vm.includePoints = [
			{ latitude: bounds.sw.latitude, longitude: bounds.sw.longitude },
			{ latitude: bounds.ne.latitude, longitude: bounds.ne.longitude }
		];
	}

	setStyle(style) {
		// 微信原生 map 不支持运行时切换主题，记录样式不做操作
		console.log('[MiniMap] 微信原生 map 不支持运行时切换主题');
	}

	onClick(handler) {
		this._clickHandler = handler;
	}

	offClick() {
		this._clickHandler = null;
	}

	/** 在 @tap 事件中调用，分发坐标 */
	handleTap(e) {
		if (this._clickHandler && e && e.detail) {
			this._clickHandler({
				longitude: e.detail.longitude,
				latitude: e.detail.latitude
			});
		}
	}

	// ---- 覆盖物 ----

	addMarker(point, options = {}) {
		const marker = {
			id: Date.now(),
			latitude: point.latitude,
			longitude: point.longitude,
			iconPath: options.iconPath || '/static/logo.png',
			width: options.width || 30,
			height: options.height || 30,
			callout: options.title ? { content: options.title, fontSize: 12, borderRadius: 8, padding: 8, display: 'ALWAYS' } : undefined
		};
		this._vm.markers = [...this._vm.markers, marker];
	}

	addPolyline(points, options = {}) {
		this._vm.polylines = [...this._vm.polylines, {
			points: points.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
			color: options.color || '#007aff',
			width: options.width || 3,
			dottedLine: options.dashed || false
		}];
	}

	addPolygon(points, options = {}) {
		this._vm.polygons = [...this._vm.polygons, {
			points: points.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
			fillColor: options.fillColor || 'rgba(0,122,255,0.2)',
			strokeColor: options.strokeColor || '#007aff',
			strokeWidth: options.strokeWidth || 2
		}];
	}

	clear() {
		this._vm.markers = [];
		this._vm.polylines = [];
		this._vm.polygons = [];
	}

	updateLocation(locationData) {
		this.moveTo({ latitude: locationData.latitude, longitude: locationData.longitude });
		this.addMarker(
			{ latitude: locationData.latitude, longitude: locationData.longitude },
			{ title: locationData.address && locationData.address.name }
		);
	}
}

// ======================== H5 实现 ========================
class H5MapController {
	constructor(options) {
		this._map = options.mapInstance;
		this._layerIds = [];
		this._clickHandler = null;
		if (this._map) {
			this._map.on('click', (e) => {
				if (this._clickHandler && e.lngLat) {
					this._clickHandler({ longitude: e.lngLat.lng, latitude: e.lngLat.lat });
				}
			});
		}
	}

	// ---- 基础操作 ----

	getCenter() {
		if (!this._map) return Promise.resolve(null);
		const c = this._map.getCenter();
		return Promise.resolve({ longitude: c.lng, latitude: c.lat });
	}

	flyTo(center, zoom = 13) {
		if (!this._map) return;
		this._map.flyTo({ center: [center.longitude, center.latitude], zoom, speed: 1, curve: 2, easing(t) { return t; } });
	}

	moveTo(center) {
		if (!this._map) return;
		this._map.setCenter([center.longitude, center.latitude]);
	}

	getBounds() {
		if (!this._map) return Promise.resolve(null);
		const b = this._map.getBounds();
		return Promise.resolve({
			sw: { latitude: b.getSouth(), longitude: b.getWest() },
			ne: { latitude: b.getNorth(), longitude: b.getEast() }
		});
	}

	fitBounds(bounds, padding = 50) {
		if (!this._map) return;
		this._map.fitBounds(
			[[bounds.sw.longitude, bounds.sw.latitude], [bounds.ne.longitude, bounds.ne.latitude]],
			{ padding }
		);
	}

	setStyle(style) {
		if (!this._map) return;
		this._map.setStyle(style);
	}

	onClick(handler) {
		this._clickHandler = handler;
	}

	offClick() {
		this._clickHandler = null;
	}

	// ---- 覆盖物 ----

	addMarker(point, options = {}) {
		if (!this._map) return;
		const marker = new window.aimap.Marker()
			.setLngLat([point.longitude, point.latitude])
			.addTo(this._map);
		if (options.title) {
			marker.setPopup(new window.aimap.Popup({ offset: [0, -30] }).setText(options.title));
			marker.togglePopup();
		}
		return marker;
	}

	addPolyline(points, options = {}) {
		if (!this._map) return;
		const coords = points.map(p => [p.longitude, p.latitude]);
		const id = 'line-' + Date.now();
		this._map.addLayer({
			id, type: 'line',
			source: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } },
			paint: { 'line-color': options.color || '#007aff', 'line-width': options.width || 3, 'line-dasharray': options.dashed ? [2, 2] : [1, 0] }
		});
		this._layerIds.push(id);
	}

	addPolygon(points, options = {}) {
		if (!this._map) return;
		const coords = points.map(p => [p.longitude, p.latitude]);
		if (coords.length > 0) coords.push(coords[0]);
		const id = 'polygon-' + Date.now();
		this._map.addLayer({
			id, type: 'fill',
			source: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } } },
			paint: { 'fill-color': options.fillColor || 'rgba(0,122,255,0.2)', 'fill-outline-color': options.strokeColor || '#007aff' }
		});
		this._layerIds.push(id);
	}

	clear() {
		if (!this._map) return;
		this._layerIds.forEach(id => {
			try { if (this._map.getLayer(id)) this._map.removeLayer(id); } catch (e) {}
			try { if (this._map.getSource(id)) this._map.removeSource(id); } catch (e) {}
		});
		this._layerIds = [];
	}

	updateLocation(locationData) {
		this.addMarker({ latitude: locationData.latitude, longitude: locationData.longitude }, { title: locationData.address && locationData.address.name });
		this.moveTo({ latitude: locationData.latitude, longitude: locationData.longitude });
	}
}

// ======================== 工厂函数 ========================

export function createMapController(platform, options = {}) {
	switch (platform) {
		case 'app-plus':  return new AppMapController(options);
		case 'mp-weixin': return new MiniMapController(options);
		case 'h5':        return new H5MapController(options);
		default:
			console.warn('[MapController] 未知平台: ' + platform + '，使用 H5 兜底');
			return new H5MapController(options);
	}
}

// 预定义样式
export const MAP_STYLES = {
	white: 'aimap://styles/aimap/white-21Q4-v1',
	dark:  'aimap://styles/aimap/darkblue-v4'
};
