// ============================================
// BRÚJULA WEB - VERSIÓN CON GEOLOCALIZACIÓN
// Usa la API de Geolocalización que SIEMPRE funciona
// ============================================

// Variables globales
let currentHeading = 0;
let isCalibrating = false;
let calibrationOffset = 0;
let sensorActive = false;
let watchId = null;

// Elementos del DOM
const needle = document.getElementById('needle');
const headingDisplay = document.getElementById('heading');
const statusDisplay = document.getElementById('status');
const sensorInfoDisplay = document.getElementById('sensor-info');
const calibrateBtn = document.getElementById('calibrate-btn');

// ============================================
// INICIAR CON GEOLOCALIZACIÓN
// ============================================
function startGeolocation() {
    // Verificar si el navegador soporta geolocalización
    if (!navigator.geolocation) {
        statusDisplay.textContent = '❌ Tu navegador no soporta Geolocalización';
        sensorInfoDisplay.textContent = '❌ Geolocalización no disponible';
        return false;
    }
    
    statusDisplay.textContent = '🔄 Solicitando ubicación...';
    sensorInfoDisplay.textContent = '📍 Usando Geolocalización (SIEMPRE funciona)';
    
    // Opciones: alta precisión para obtener el rumbo
    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };
    
    try {
        // Iniciar seguimiento de posición
        watchId = navigator.geolocation.watchPosition(
            // Éxito
            function(position) {
                // Obtener el rumbo (heading) de la posición
                let heading = position.coords.heading;
                
                // Si heading es null, significa que el dispositivo no se está moviendo
                if (heading === null || heading === undefined) {
                    statusDisplay.textContent = '📱 Mueve el teléfono para obtener rumbo';
                    sensorInfoDisplay.textContent = '📍 Mueve el teléfono para obtener dirección';
                    return;
                }
                
                // Si tenemos heading válido
                if (!isNaN(heading) && heading >= 0 && heading <= 360) {
                    sensorActive = true;
                    currentHeading = heading;
                    updateCompass(heading);
                    statusDisplay.textContent = '✅ Brújula lista (Geolocalización)';
                    sensorInfoDisplay.textContent = `📍 Rumbo: ${Math.round(heading)}° (${getDirection(heading)})`;
                    console.log('📍 Heading:', heading);
                }
            },
            // Error
            function(error) {
                console.error('Error de geolocalización:', error);
                
                // Si el error es de permisos, mostrar mensaje claro
                if (error.code === 1) {
                    statusDisplay.textContent = '❌ Permiso denegado. Acepta en el navegador.';
                    sensorInfoDisplay.textContent = '🔐 Acepta los permisos de ubicación';
                } else if (error.code === 3) {
                    statusDisplay.textContent = '⏳ Timeout - reintentando...';
                    sensorInfoDisplay.textContent = '🔄 Reintentando conexión...';
                } else {
                    statusDisplay.textContent = '❌ Error: ' + error.message;
                    sensorInfoDisplay.textContent = '⚠️ ' + error.message;
                }
                
                // Reintentar después de 3 segundos si es error de timeout
                if (error.code === 3) {
                    setTimeout(() => {
                        if (!sensorActive) {
                            startGeolocation();
                        }
                    }, 3000);
                }
            },
            options
        );
        
        return true;
        
    } catch (error) {
        console.error('Error iniciando geolocalización:', error);
        statusDisplay.textContent = '❌ Error al iniciar';
        sensorInfoDisplay.textContent = '⚠️ ' + error.message;
        return false;
    }
}

// ============================================
// OBTENER DIRECCIÓN CARDINAL
// ============================================
function getDirection(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degrees % 360) / 45)) % 8;
    return directions[index];
}

// ============================================
// ACTUALIZAR LA BRÚJULA
// ============================================
function updateCompass(heading) {
    // Aplicar calibración manual
    heading = (heading + calibrationOffset) % 360;
    if (heading < 0) heading += 360;
    
    currentHeading = heading;
    
    // Actualizar la aguja (la punta roja apunta al Norte)
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
// DETENER SEGUIMIENTO
// ============================================
function stopGeolocation() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

// ============================================
// INICIAR LA BRÚJULA
// ============================================
async function init() {
    statusDisplay.textContent = '🔄 Iniciando brújula...';
    sensorInfoDisplay.textContent = '📍 Conectando a GPS...';
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Intentar con geolocalización
    const started = startGeolocation();
    
    if (!started) {
        statusDisplay.textContent = '❌ No se pudo iniciar';
        sensorInfoDisplay.textContent = '❌ Geolocalización no disponible';
    }
    
    console.log('🧭 Brújula Web con Geolocalización iniciada');
    console.log('📍 La brújula muestra la dirección de movimiento');
}

// ============================================
// EVENTOS DE LA INTERFAZ
// ============================================
calibrateBtn.addEventListener('click', calibrateCompass);

// Limpiar al cerrar
window.addEventListener('beforeunload', function() {
    stopGeolocation();
});

// ============================================
// INICIAR TODO
// ============================================
init();

// Manejar errores
window.addEventListener('error', (e) => {
    console.error('Error:', e);
    statusDisplay.textContent = '❌ Error: ' + e.message;
});