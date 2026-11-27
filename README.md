# 💊 Sistema de Gestión Farmacéutica "Dulce María"

> Plataforma web para el control de inventarios, gestión de lotes y ventas farmacéuticas.

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-Backend-000000?style=flat-square&logo=express)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql&logoColor=white)

---

## 📋 Arquitectura del Sistema
- **Frontend:** SPA desarrollada en React con Vite y soporte PWA.
- **Backend:** API REST modular construida sobre Node.js y Express.js.
- **Base de Datos:** MySQL relacional (`farmacia_dm.sql`), diseñada para trazabilidad de stock, lotes y usuarios con roles.

---

## 🚀 Puesta en Marcha

### 1. Clonar e Instalar
```bash
git clone https://github.com/jonathan-albarran/Farmacia.git
cd Farmacia
npm install
cd Backend && npm install && cd ..
cd Frontend && npm install && cd ..