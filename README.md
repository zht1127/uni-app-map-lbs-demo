# uni-app 跨端地图 Demo

基于 uni-app 的跨端地图定位示例，使用**位置智（newayz）aimap-gl** 地图 SDK 和定位服务。

支持 **App（Android/iOS）、微信小程序、H5** 三端运行。

## 快速开始

### 1. 申请 KEY

在 [lotboard.newayz.com](https://lotboard.newayz.com/) 注册并获取：
- 定位 KEY（用于定位、逆地理编码）
- 地图 AccessToken（用于加载地图瓦片）

### 2. 配置 KEY

**H5 端**（`utils/config.js`）：

```js
export const LOCATION_KEY = 'YOUR_LOCATION_KEY';
export const POI_KEY = 'YOUR_POI_KEY';
export const MAP_ACCESS_TOKEN = 'YOUR_MAP_ACCESS_TOKEN';
```

**App 端**（`static/map/map_view.html`）：

```js
aimap.accessToken = 'YOUR_MAP_ACCESS_TOKEN';
```

### 3. 运行

```bash
# H5 开发
npm run dev:h5

# 微信小程序
npm run dev:mp-weixin

# App 端（使用 HBuilderX 运行到真机）
```

## 功能

- 单次定位 / 连续定位
- 逆地理编码（坐标 → 地址）
- 正地理编码（地址 → 坐标）
- POI 关键词搜索 / 附近搜索
- 地图中心点 / 视野范围获取
- 白天 / 暗黑地图主题切换

## 架构

```
index.vue          # 主页面（三端条件编译，共用按钮定义和业务逻辑）
├── App端 → web-view 加载 map_view.html → evalJS 注入 UI
├── 小程序 → uni-app <map> 原生组件
└── H5端   → aimap-gl SDK 直接操作 DOM

utils/
├── config.js      # H5 端 KEY 配置
├── map.js         # 三端地图控制器抽象层
└── wz_sdk_uniapp.js  # 位置智定位 SDK
```

## 技术栈

- uni-app（Vue 2）
- 位置智 aimap-gl（Mapbox GL JS 分支）
- 位置智定位 SDK

## 目录结构

```
├── pages/index/index.vue   # 主页面
├── static/map/map_view.html # App 端地图壳
├── utils/
│   ├── config.js            # KEY 配置
│   ├── map.js               # 地图控制器
│   └── wz_sdk_uniapp.js     # 定位 SDK
├── pages.json               # 页面配置
└── manifest.json            # 应用配置
```
