CREATE TABLE IF NOT EXISTS `management_funds` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `job_name` VARCHAR(50) NOT NULL,
    `amount` INT(11) NOT NULL DEFAULT 0,
    `type` VARCHAR(50) NOT NULL DEFAULT 'boss',
    PRIMARY KEY (`id`),
    UNIQUE KEY `job_name` (`job_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `management_transactions` (
    `id` INT(11) NOT NULL AUTO_INCREMENT,
    `job_name` VARCHAR(50) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `amount` INT(11) NOT NULL,
    `source` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) DEFAULT '',
    `date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;