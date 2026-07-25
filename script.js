// ============================================
// BRÚJULA WEB - VERSIÓN FINAL
// Usa AbsoluteOrientationSensor + fallbacks
// ============================================

// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;
let sensorActive = false;
let sensorType = 'ninguno';
let sensor = null;
let useFallback = false;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const sensorInfoDisplay = document.getElementById('sensor-info');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// QUATERNION A GRADOS (heading)
// ============================================
function quaternionToHeading(q) {
    // Convertir quaternion a ángulo de heading (yaw)
    // q = [x, y, z, w] (w es el escalar)
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    
    // Calcular yaw (heading) desde el quaternion
    // Fórmula: yaw = atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z))
    const siny = 2 * (w * z + x * y);
    const cosy = 1 - 2 * (y * y + z * z);
    let heading = Math.atan2(siny, cosy) * (180 / Math.PI);
    
    // Normalizar a 0-360
    heading = (heading + 360) % 360;
    return heading;
}

// ============================================
// ROTATION MATRIX A GRADOS
// ============================================
function matrixToHeading(matrix) {
    // Extraer heading de una matriz de rotación 4x4
    // Usando la convención: heading = atan2(m[1][0], m[0][0])
    // m[0][0] = matrix[0], m[1][0] = matrix[4], m[0][1] = matrix[1]
    let heading = Math.atan2(matrix[4], matrix[0]) * (180 / Math.PI);
    heading = (heading + 360) % 360;
    return heading;
}

// ============================================
// INICIAR ABSOLUTE ORIENTATION SENSOR
// ============================================
function startAbsoluteOrientation() {
    try {
        // Verificar si la API está disponible
        if (!window.AbsoluteOrientationSensor) {
            console.warn('AbsoluteOrientationSensor no disponible');
            sensorInfoDisplay.textContent = '⚠️ AbsoluteOrientationSensor no disponible';
            return false;
        }
        
        sensorInfoDisplay.textContent = '🔍 Iniciando AbsoluteOrientationSensor...';
        statusDisplay.textContent = '🔄 Conectando...';
        
        // Crear el sensor con frecuencia alta
        sensor = new AbsoluteOrientationSensor({
            frequency: 60,
            referenceFrame: 'device'
        });
        
        // Evento de lectura
        sensor.addEventListener('reading', () => {
            let heading = null;
            
            // Intentar obtener el quaternion
            if (sensor.quaternion) {
                const q = sensor.quaternion;
                heading = quaternionToHeading(q);
                sensorType = 'absolute-quaternion';
                console.log('🧭 Quaternion heading:', heading);
            }
            // Fallback: usar matriz de rotación
            else if (sensor.rotationMatrix) {
                heading = matrixToHeading(sensor.rotationMatrix);
                sensorType = 'absolute-matrix';
                console.log('🧭 Matrix heading:', heading);
            }
            
            if (heading !== null && !isNaN(heading)) {
                sensorActive = true;
                currentHeading = heading;
                updateCompass(heading);
                statusDisplay.textContent = '✅ Brújula lista';
                sensorInfoDisplay.textContent = '🎯 Usando AbsoluteOrientationSensor';
            }
        });
        
        // Evento de error
        sensor.addEventListener('error', (event) => {
            const error = event.error || event;
            console.error('Sensor error:', error);
            sensorInfoDisplay.textContent = '⚠️ Error: ' + (error.message || 'desconocido');
            
            // Si falla, intentar con el fallback
            if (!sensorActive && !useFallback) {
                useFallback = true;
                sensorInfoDisplay.textContent = '🔄 Fallback a DeviceOrientation...';
                startDeviceOrientation();
            }
        });
        
        // Iniciar el sensor
        sensor.start();
        
        // Timeout: si no hay datos en 3 segundos, probar fallback
        setTimeout(() => {
            if (!sensorActive && !useFallback) {
                useFallback = true;
                sensorInfoDisplay.textContent = '⏳ Sin datos, probando DeviceOrientation...';
                startDeviceOrientation();
            }
        }, 3000);
        
        return true;
        
    } catch (error) {
        console.error('Error iniciando AbsoluteOrientationSensor:', error);
        sensorInfoDisplay.textContent = '⚠️ Error en AbsoluteOrientationSensor';
        
        if (!useFallback) {
            useFallback = true;
            startDeviceOrientation();
        }
        return false;
    }
}

// ============================================
// FALLBACK: DEVICE ORIENTATION
// ============================================
function startDeviceOrientation() {
    try {
        if (typeof DeviceOrientationEvent === 'undefined') {
            statusDisplay.textContent = '❌ No hay sensores disponibles';
            sensorInfoDisplay.textContent = '❌ Tu dispositivo no soporta sensores';
            return false;
        }
        
        sensorInfoDisplay.textContent = '📱 Usando DeviceOrientation (fallback)';
        
        // iOS 13+ requiere permiso
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(state => {
                    console.log('Permiso iOS:', state);
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                        statusDisplay.textContent = '✅ Permiso concedido';
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
            
            // Timeout para verificar si hay datos
            setTimeout(() => {
                if (!sensorActive) {
                    statusDisplay.textContent = '🔄 Mueve el teléfono en forma de 8';
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
// MANEJAR DEVICE ORIENTATION (FALLBACK)
// ============================================
function handleDeviceOrientation(event) {
    let heading = null;
    
    // iOS
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        heading = event.webkitCompassHeading;
        sensorType = 'fallback-ios';
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
        sensorType = 'fallback-android';
        console.log('📱 Android heading:', heading);
        statusDisplay.textContent = '✅ Brújula lista';
    }
    
    if (heading !== null) {
        sensorActive = true;
        currentHeading = heading;
        updateCompass(heading);
        sensorInfoDisplay.textContent = `📱 Usando ${sensorType === 'fallback-ios' ? 'iOS' : 'Android'} DeviceOrientation (fallback)`;
    }
}

// ============================================
// ACTUALIZAR LA BRÚJULA
// ============================================
function updateCompass(heading) {
    // Aplicar calibración manual
    heading = (heading + calibrationOffset) % 360;
    if (heading < 0) heading += 360;
    
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
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    
    console.log(`📱 Dispositivo: ${isIOS ? 'iOS' : isAndroid ? 'Android' : 'Otro'}`);
    
    if (isIOS) {
        // En iOS usar DeviceOrientation directamente
        sensorInfoDisplay.textContent = '🍎 Detectado iOS - usando DeviceOrientation';
        startDeviceOrientation();
    } else {
        // En Android y otros, probar AbsoluteOrientationSensor primero
        sensorInfoDisplay.textContent = '🎯 Probando AbsoluteOrientationSensor...';
        const started = startAbsoluteOrientation();
        
        // Si no se inició, el fallback se activa automáticamente
        if (!started) {
            sensorInfoDisplay.textContent = '⚠️ Iniciando fallback...';
        }
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