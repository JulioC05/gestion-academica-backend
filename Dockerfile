# 1. Usamos una imagen liviana y oficial de Node.js como base
FROM node:18-alpine

# 2. Creamos y nos situamos en la carpeta de trabajo dentro del contenedor
WORKDIR /usr/src/app

# 3. Copiamos los archivos de configuración de dependencias
COPY package*.json ./

# 4. Instalamos solo las librerías necesarias de forma limpia
RUN npm install --production

# 5. Copiamos todo el código fuente de nuestra carpeta 'src'
COPY src/ ./src/

# 6. Exponemos el puerto en el que corre tu servidor Express
EXPOSE 3001

# 7. Comando por defecto para arrancar el microservicio dentro de Docker
CMD ["node", "src/app.js"]