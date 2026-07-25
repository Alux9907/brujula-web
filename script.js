// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// FUNCIÓN PRINCIPAL: Manejar la orientación
// ============================================
function handleOrientation(event) {
    let heading = null;
    
    console.log('Evento de orientación recibido:', event);
    
    // DETECTAR iOS (Safari)
    if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
        heading = event.webkitCompassHeading;
        console.log('iOS - webkitCompassHeading:', heading);
        
        // Precisión en iOS
        if (event.webkitCompassAccuracy !== undefined) {
            const accuracy = event.webkitCompassAccuracy;
            if (accuracy < 0) {
                statusDisplay.textContent = '⚠️ Sensor no disponible';
                return;
            } else if (accuracy > 20) {
                statusDisplay.textContent = '🔄 Calibrando... mueve el teléfono en forma de 8';
            } else {
                statusDisplay.textContent = '✅ Brújula lista (iOS)';
            }
        }
    }
    // DETECTAR Android y otros
    else if (event.alpha !== undefined && event.alpha !== null) {
        heading = event.alpha;
        console.log('Android/otros - alpha:', heading);
        
        if (event.absolute === true) {
            statusDisplay.textContent = '✅ Brújula lista (absoluta)';
        } else {
            statusDisplay.textContent = '✅ Brújula lista (relativa)';
        }
    }
    // Si no se pudo obtener el rumbo
    else {
        statusDisplay.textContent = '⚠️ Esperando datos del sensor...';
        console.warn('No se pudo obtener heading del evento:', event);
        return;
    }
    
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
// SOLICITAR PERMISO (necesario en iOS 13+)
// ============================================
async function requestPermission() {
    try {
        // Verificar si el navegador soporta DeviceOrientationEvent
        if (typeof DeviceOrientationEvent === 'undefined') {
            statusDisplay.textContent = '❌ Tu navegador no soporta DeviceOrientation';
            return false;
        }
        
        // iOS 13+ requiere permiso explícito
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            statusDisplay.textContent = '🔐 Solicitando permiso...';
            const permissionState = await DeviceOrientationEvent.requestPermission();
            console.log('Permiso iOS:', permissionState);
            
            if (permissionState === 'granted') {
                statusDisplay.textContent = '✅ Permiso concedido';
                window.addEventListener('deviceorientation', handleOrientation, true);
                
                // Verificar si llegan datos
                setTimeout(() => {
                    if (currentHeading === 0) {
                        statusDisplay.textContent = '⏳ Esperando datos del sensor...';
                    }
                }, 2000);
                
                return true;
            } else {
                statusDisplay.textContent = '❌ Permiso denegado por el usuario';
                return false;
            }
        } else {
            // Android y iOS antiguos
            statusDisplay.textContent = '✅ Conectando al sensor...';
            window.addEventListener('deviceorientation', handleOrientation, true);
            
            // Verificar si llegan datos después de 3 segundos
            setTimeout(() => {
                if (currentHeading === 0) {
                    statusDisplay.textContent = '⏳ Mueve el teléfono para activar el sensor';
                } else {
                    statusDisplay.textContent = '✅ Brújula activa';
                }
            }, 3000);
            
            return true;
        }
    } catch (error) {
        console.error('Error al solicitar permiso:', error);
        statusDisplay.textContent = '❌ Error: ' + error.message;
        return false;
    }
}

// ============================================
// CALIBRACIÓN MANUAL
// ============================================
function calibrateCompass() {
    if (isCalibrating) return;
    if (currentHeading === 0) {
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
            
            const fakeEvent = { alpha: currentHeading, webkitCompassHeading: currentHeading };
            handleOrientation(fakeEvent);
        }
    }, 200);
}

// ============================================
// DETECTAR SI EL DISPOSITIVO TIENE SENSORES
// ============================================
function checkSensorSupport() {
    // Verificar si el navegador soporta DeviceOrientation
    if (typeof DeviceOrientationEvent === 'undefined') {
        statusDisplay.textContent = '❌ Tu navegador no soporta sensores de orientación';
        return false;
    }
    
    // En Android, podemos verificar si existe el sensor
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'sensors' })
            .then(result => {
                console.log('Permiso de sensores:', result.state);
                if (result.state === 'denied') {
                    statusDisplay.textContent = '❌ Permiso de sensores denegado';
                }
            })
            .catch(err => console.log('No se pudo verificar permisos:', err));
    }
    
    return true;
}

// ============================================
// INICIAR LA BRÚJULA
// ============================================
async function init() {
    statusDisplay.textContent = '🔄 Iniciando brújula...';
    
    // Verificar soporte
    if (!checkSensorSupport()) {
        return;
    }
    
    // Esperar un momento
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const success = await requestPermission();
    
    if (!success) {
        statusDisplay.textContent = '❌ No se pudo iniciar la brújula';
    }
    
    // Mensaje de ayuda
    console.log('🧭 Brújula Web iniciada');
    console.log('📱 Si no funciona, prueba:');
    console.log('   1. Asegúrate de estar en HTTPS');
    console.log('   2. Acepta los permisos del navegador');
    console.log('   3. Mueve el teléfono en forma de 8');
    console.log('   4. En iOS: ve a Configuración > Safari > Permisos');
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