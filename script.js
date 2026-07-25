// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;
let sensorActive = false;
let sensorType = 'ninguno';
let magnetometer = null;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const sensorInfoDisplay = document.getElementById('sensor-info');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// CALCULAR RUMBO DESDE MAGNETÓMETRO
// ============================================
function calculateHeadingFromMagnetometer(x, y) {
    if (x === null || y === null || isNaN(x) || isNaN(y)) {
        return null;
    }
    
    // Fórmula estándar para el rumbo desde el magnetómetro
    let heading = Math.atan2(y, x) * (180 / Math.PI);
    
    // Normalizar a 0-360 grados
    heading = (heading + 360) % 360;
    
    // Ajustar para que 0 = Norte (el sensor magnético da 0 = Este)
    heading = (heading + 90) % 360;
    
    return heading;
}

// ============================================
// INICIAR MAGNETOMETER (Android)
// ============================================
function startMagnetometer() {
    try {
        // Verificar si la API está disponible
        if (!window.Magnetometer) {
            console.warn('Magnetometer API no disponible');
            return false;
        }
        
        sensorInfoDisplay.textContent = '🔍 Intentando Magnetometer API...';
        statusDisplay.textContent = '🔄 Iniciando Magnetometer...';
        
        // Crear el sensor con frecuencia alta
        magnetometer = new Magnetometer({ frequency: 60 });
        
        // Evento cuando hay lectura
        magnetometer.addEventListener('reading', () => {
            const x = magnetometer.x;
            const y = magnetometer.y;
            const z = magnetometer.z;
            
            console.log('🧲 Magnetometer:', { x, y, z });
            
            // Calcular rumbo
            const heading = calculateHeadingFromMagnetometer(x, y);
            
            if (heading !== null) {
                sensorActive = true;
                sensorType = 'magnetometer';
                currentHeading = heading;
                
                // Actualizar UI
                updateCompass(heading);
                statusDisplay.textContent = '✅ Brújula (Magnetometer)';
                sensorInfoDisplay.textContent = '🧲 Usando Magnetometer API';
            }
        });
        
        // Evento de error
        magnetometer.addEventListener('error', (event) => {
            const error = event.error || event;
            console.error('Magnetometer error:', error);
            
            // Si falla, intentar con DeviceOrientation
            if (!sensorActive) {
                sensorInfoDisplay.textContent = '⚠️ Magnetometer falló, intentando DeviceOrientation...';
                startDeviceOrientation();
            }
        });
        
        // Iniciar el sensor
        magnetometer.start();
        
        // Timeout: si no hay datos en 3 segundos, probar DeviceOrientation
        setTimeout(() => {
            if (!sensorActive) {
                sensorInfoDisplay.textContent = '⏳ Magnetometer sin datos, probando DeviceOrientation...';
                startDeviceOrientation();
            }
        }, 3000);
        
        return true;
        
    } catch (error) {
        console.error('Error iniciando Magnetometer:', error);
        sensorInfoDisplay.textContent = '⚠️ Error en Magnetometer, probando DeviceOrientation...';
        startDeviceOrientation();
        return false;
    }
}

// ============================================
// INICIAR DEVICEORIENTATION (iOS y fallback)
// ============================================
function startDeviceOrientation() {
    try {
        if (typeof DeviceOrientationEvent === 'undefined') {
            statusDisplay.textContent = '❌ No hay sensores disponibles';
            sensorInfoDisplay.textContent = '❌ Tu navegador no soporta sensores';
            return false;
        }
        
        sensorInfoDisplay.textContent = '📱 Intentando DeviceOrientation...';
        
        // iOS 13+ requiere permiso
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    console.log('Permiso iOS:', state);
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                        statusDisplay.textContent = '✅ Permiso concedido';
                        sensorInfoDisplay.textContent = '🍎 Usando DeviceOrientation (iOS)';
                    } else {
                        statusDisplay.textContent = '❌ Permiso denegado';
                        sensorInfoDisplay.textContent = '❌ Acepta los permisos en Ajustes';
                    }
                })
                .catch(err => {
                    console.error('Error en permiso:', err);
                    statusDisplay.textContent = '❌ Error de permiso';
                });
        } else {
            // Android y otros
            window.addEventListener('deviceorientation', handleDeviceOrientation, true);
            statusDisplay.textContent = '✅ Escuchando DeviceOrientation...';
            sensorInfoDisplay.textContent = '📱 Usando DeviceOrientation (Android)';
            
            // Timeout para verificar si hay datos
            setTimeout(() => {
                if (!sensorActive) {
                    statusDisplay.textContent = '⚠️ Mueve el teléfono en forma de 8';
                    sensorInfoDisplay.textContent = '🔄 Calibrando sensor magnético...';
                }
            }, 3000);
        }
        
        return true;
        
    } catch (error) {
        console.error('Error en DeviceOrientation:', error);
        statusDisplay.textContent = '❌ Error en sensores';
        return false;
    }
}

// ============================================
// MANEJAR DEVICEORIENTATION
// ============================================
function handleDeviceOrientation(event) {
    let heading = null;
    
    // iOS
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        heading = event.webkitCompassHeading;
        sensorType = 'deviceorientation-ios';
        console.log('🍎 iOS heading:', heading);
        
        if (event.webkitCompassAccuracy !== undefined) {
            const accuracy = event.webkitCompassAccuracy;
            if (accuracy < 0) {
                statusDisplay.textContent = '⚠️ Sensor no disponible';
                return;
            } else if (accuracy > 20) {
                statusDisplay.textContent = '🔄 Calibrando...';
            } else {
                statusDisplay.textContent = '✅ Brújula lista';
            }
        }
    }
    // Android
    else if (event.alpha !== undefined && event.alpha !== null && !isNaN(event.alpha)) {
        heading = event.alpha;
        sensorType = 'deviceorientation-android';
        console.log('📱 Android heading:', heading);
        statusDisplay.textContent = '✅ Brújula lista';
    }
    
    // Si tenemos heading válido
    if (heading !== null) {
        sensorActive = true;
        currentHeading = heading;
        updateCompass(heading);
        sensorInfoDisplay.textContent = `📱 Usando ${sensorType === 'deviceorientation-ios' ? 'iOS' : 'Android'} DeviceOrientation`;
    }
}

// ============================================
// ACTUALIZAR LA BRÚJULA
// ============================================
function updateCompass(heading) {
    // Aplicar calibración manual
    heading = (heading + calibrationOffset) % 360;
    if (heading < 0) heading += 360;
    
    // Guardar el valor actual
    currentHeading = heading;
    
    // Actualizar la aguja
    needle.style.transform = `translate(-50%, -100%) rotate(${-heading}deg)`;
    
    // Actualizar el display del rumbo
    headingDisplay.textContent = Math.round(heading);
}

// ============================================
// CALIBRACIÓN MANUAL
// ============================================
function calibrateCompass() {
    if (isCalibrating) return;
    if (!sensorActive) {
        statusDisplay.textContent = '⚠️ Espera a que la brújula se active';
        return;
    }
    
    isCalibrating = true;
    calibrateBtn.textContent = '🔄 Calibrando...';
    
    let readings = [];
    const maxReadings = 10;
    let count = 0;
    
    const interval = setInterval(() => {
        if (currentHeading !== 0) {
            readings.push(currentHeading);
            count++;
            statusDisplay.textContent = `📊 Calibrando... ${count}/${maxReadings}`;
        }
        
        if (count >= maxReadings) {
            clearInterval(interval);
            
            const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
            
            let offset = 0;
            if (avg > 10 && avg < 350) {
                offset = -avg;
                while (offset < 0) offset += 360;
            }
            
            calibrationOffset = offset;
            isCalibrating = false;
            calibrateBtn.textContent = '🔄 Calibrar';
            statusDisplay.textContent = `✅ Calibrado (offset: ${Math.round(calibrationOffset)}°)`;
            
            // Actualizar inmediatamente
            updateCompass(currentHeading);
        }
    }, 200);
}

// ============================================
// INICIAR LA BRÚJULA
// ============================================
async function init() {
    statusDisplay.textContent = '🔄 Iniciando brújula...';
    sensorInfoDisplay.textContent = '🔍 Detectando sensores...';
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar si el dispositivo es iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    
    console.log(`📱 Dispositivo: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Otro'}`);
    
    if (isIOS) {
        // En iOS usar DeviceOrientation
        sensorInfoDisplay.textContent = '🍎 Detectado iOS - usando DeviceOrientation';
        startDeviceOrientation();
    } else if (isAndroid) {
        // En Android intentar Magnetometer primero
        sensorInfoDisplay.textContent = '🤖 Detectado Android - probando Magnetometer...';
        const magnetometerStarted = startMagnetometer();
        
        // Si Magnetometer no se inició, probar DeviceOrientation
        if (!magnetometerStarted) {
            startDeviceOrientation();
        }
    } else {
        // Otros dispositivos
        sensorInfoDisplay.textContent = '💻 Dispositivo no móvil - probando DeviceOrientation...';
        startDeviceOrientation();
    }
    
    console.log('🧭 Brújula Web iniciada');
}

// ============================================
// EVENTOS DE LA INTERFAZ
// ============================================
calibrateBtn.addEventListener('click', calibrateCompass);

// ============================================
// INICIAR TODO
// ============================================
init();

// Manejar errores
window.addEventListener('error', (e) => {
    console.error('Error:', e);
    statusDisplay.textContent = '❌ Error: ' + e.message;
});